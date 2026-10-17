import { describe, expect, it } from 'vitest';

import { type Answer, createReadCache } from './read-cache';

const ok = (body: string): Answer => ({ status: 200, body });

describe('createReadCache (R-WEB-6)', () => {
  const setup = (ttlMs = 30_000, maxEntries = 3) => {
    let time = 0;
    const calls: string[] = [];
    const cached = createReadCache({ ttlMs, maxEntries, now: () => time });
    const load = (key: string, answer: Answer | Error = ok(key)) =>
      cached(key, async () => {
        calls.push(key);
        if (answer instanceof Error) {
          throw answer;
        }
        return answer;
      });
    return { load, calls, advance: (ms: number) => (time += ms) };
  };

  it('answers from memory within its time, and asks again after it, never serving an older answer', async () => {
    const { load, calls, advance } = setup();
    await load('/a');
    advance(29_999);
    await load('/a');
    expect(calls).toEqual(['/a']);
    advance(1);
    await load('/a');
    expect(calls).toEqual(['/a', '/a']);
  });

  it('shares one request among readers asking at once', async () => {
    const { load, calls } = setup();
    const answers = await Promise.all([load('/p'), load('/p'), load('/p')]);
    expect(calls).toEqual(['/p']);
    expect(answers.map((answer) => answer.body)).toEqual(['/p', '/p', '/p']);
  });

  it('keeps a 404 or a 410, but never a failure or a server error', async () => {
    const { load, calls } = setup();
    await load('/gone', { status: 410, body: '' });
    await load('/gone');
    await load('/down', { status: 503, body: '' });
    await load('/down');
    await expect(load('/broken', new Error('timeout'))).rejects.toThrow('timeout');
    await load('/broken');
    expect(calls).toEqual(['/gone', '/down', '/down', '/broken', '/broken']);
  });

  it('holds a bounded number of answers, dropping the oldest', async () => {
    const { load, calls } = setup(30_000, 2);
    await load('/1');
    await load('/2');
    await load('/3');
    await load('/1');
    expect(calls).toEqual(['/1', '/2', '/3', '/1']);
  });
});
