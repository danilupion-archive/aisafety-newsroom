import { abandonCrashed, claimDue, clearOldPageText, staleQueued } from './jobs.js';
import { editReply, failedReply, processItem, replyText, type WorkerDeps } from './process.js';

/** Items fetched per round at most (R-FET-1). */
export const BATCH = 10;

/** How often the loop clears old pages' text (Q9): it has days to do it, so once an hour is plenty. */
export const CLEAR_EVERY_MS = 60 * 60 * 1000;

/**
 * One round: gives up on items that crashed the worker on every attempt, then claims what's due and fetches it. One
 * claim per item, so a page that crashes the worker costs only its own attempt, not those of a whole batch (R-FET-5).
 * Returns how many it fetched.
 */
export const runOnce = async (deps: WorkerDeps): Promise<number> => {
  for (const crashed of await abandonCrashed(deps.db)) {
    await editReply(
      crashed.reply,
      replyText(failedReply(crashed.id, 'crashed'), crashed.logOnly),
      deps,
    );
  }
  let fetched = 0;
  while (fetched < BATCH) {
    const [item] = await claimDue(deps.db);
    if (!item) {
      break;
    }
    await processItem(item, deps);
    fetched += 1;
  }
  return fetched;
};

export interface LoopOptions {
  /** Between rounds that found little to do (R-FET-1: at least once a minute). */
  intervalMs: number;
  onError: (error: unknown) => void;
  /** Told how many items have waited in the queue for more than an hour, when any have (SPEC §15). */
  onStale: (count: number) => void;
  /** Q9: clears a logged or discarded item's page text after this many days, and says how many it cleared. */
  pageText?: { retentionDays: number; onCleared: (count: number) => void };
}

export interface Loop {
  /** Lets the round in progress finish, then stops. */
  stop: () => Promise<void>;
}

/** Runs rounds until stopped: straight away again after a full batch, else after the interval. */
export const startLoop = (
  deps: WorkerDeps,
  { intervalMs, onError, onStale, pageText }: LoopOptions,
): Loop => {
  let stopped = false;
  let clearedAt = Number.NEGATIVE_INFINITY;
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
      if (pageText && Date.now() - clearedAt >= CLEAR_EVERY_MS) {
        clearedAt = Date.now();
        const cleared = await clearOldPageText(deps.db, pageText.retentionDays);
        if (cleared > 0) {
          pageText.onCleared(cleared);
        }
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
