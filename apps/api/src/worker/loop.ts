import { claimDue, staleQueued } from './jobs.js';
import { processItem, type WorkerDeps } from './process.js';

/** Items claimed per round (R-FET-1). */
export const BATCH = 10;

/** One round: claims what's due and fetches it, one at a time. Returns how many it claimed. */
export const runOnce = async (deps: WorkerDeps): Promise<number> => {
  const claimed = await claimDue(deps.db, BATCH);
  for (const item of claimed) {
    await processItem(item, deps);
  }
  return claimed.length;
};

export interface LoopOptions {
  /** Between rounds that found little to do (R-FET-1: at least once a minute). */
  intervalMs: number;
  onError: (error: unknown) => void;
  /** Told how many items have waited in the queue for more than an hour, when any have (SPEC §15). */
  onStale: (count: number) => void;
}

export interface Loop {
  /** Lets the round in progress finish, then stops. */
  stop: () => Promise<void>;
}

/** Runs rounds until stopped: straight away again after a full batch, else after the interval. */
export const startLoop = (
  deps: WorkerDeps,
  { intervalMs, onError, onStale }: LoopOptions,
): Loop => {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<void> = Promise.resolve();

  const round = async (): Promise<void> => {
    let claimed = 0;
    try {
      claimed = await runOnce(deps);
      const stale = await staleQueued(deps.db);
      if (stale > 0) {
        onStale(stale);
      }
    } catch (error) {
      onError(error);
    }
    if (!stopped) {
      timer = setTimeout(
        () => {
          running = round();
        },
        claimed === BATCH ? 0 : intervalMs,
      );
    }
  };

  running = round();
  return {
    stop: async () => {
      stopped = true;
      clearTimeout(timer);
      await running;
    },
  };
};
