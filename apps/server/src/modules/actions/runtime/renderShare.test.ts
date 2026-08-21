import { describe, expect, it, vi } from 'vitest';

import { createRenderShare } from './renderShare';

const deferred = () => {
  let resolve!: (value: unknown) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<unknown>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

describe('createRenderShare', () => {
  /** The whole point: a thousand visitors of one URL are one run, not a thousand identical ones. */
  it('answers everyone waiting on the same key from one run', async () => {
    const share = createRenderShare();
    const gate = deferred();
    const produce = vi.fn(() => gate.promise);

    const all = Promise.all([1, 2, 3].map(() => share.run('k', 0, produce)));
    gate.resolve({ ok: true });

    expect(await all).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it('keeps nothing once the run is over, unless a TTL says to', async () => {
    const share = createRenderShare();
    const produce = vi.fn(() => Promise.resolve({ n: produce.mock.calls.length }));

    await share.run('k', 0, produce);
    await share.run('k', 0, produce);

    expect(produce).toHaveBeenCalledTimes(2);
    expect(share.size()).toBe(0);
  });

  it('reuses the answer for as long as the TTL allows, and runs again after', async () => {
    let now = 1_000;
    const share = createRenderShare(() => now);
    const produce = vi.fn(() => Promise.resolve({ at: now }));

    expect(await share.run('k', 500, produce)).toEqual({ at: 1_000 });
    now = 1_400;
    expect(await share.run('k', 500, produce), 'the window was still open').toEqual({ at: 1_000 });
    now = 1_600;
    expect(await share.run('k', 500, produce)).toEqual({ at: 1_600 });

    expect(produce).toHaveBeenCalledTimes(2);
  });

  it('keeps the keys apart', async () => {
    const share = createRenderShare();
    const produce = vi.fn((value: string) => Promise.resolve(value));

    const [a, b] = await Promise.all([share.run('a', 0, () => produce('a')), share.run('b', 0, () => produce('b'))]);

    expect([a, b]).toEqual(['a', 'b']);
  });

  /** A failure is shared with whoever was waiting — they would have failed too — and kept for nobody: an outage
   *  that lasted a second must not answer for a minute. */
  it('fails everyone in flight and remembers nothing', async () => {
    const share = createRenderShare();
    const gate = deferred();
    const produce = vi.fn(() => gate.promise);

    const joined = [share.run('k', 60_000, produce), share.run('k', 60_000, produce)];
    gate.reject(new Error('no route to host'));

    await expect(Promise.all(joined)).rejects.toThrow('no route to host');
    expect(share.size()).toBe(0);

    await share.run('k', 60_000, () => Promise.resolve('second chance'));
    expect(produce).toHaveBeenCalledTimes(1);
  });
});
