import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_LIMITS } from './limits';
import { createRunFetch } from './taskContext';

/** A backend answering `bytes` bytes, in chunks of 64 KB, with no `Content-Length`: counted as it streams. */
const answering =
  (bytes: number): typeof fetch =>
  () => {
    let left = bytes;
    const body = new ReadableStream<Uint8Array>({
      pull: controller => {
        if (left <= 0) {
          controller.close();

          return;
        }

        const size = Math.min(65_536, left);
        left -= size;
        controller.enqueue(new Uint8Array(size));
      }
    });

    return Promise.resolve(new Response(body, { status: 200 }));
  };

describe('what one run’s answers may carry back together', () => {
  const limits = { ...DEFAULT_LIMITS, maxResponseBytes: 3_000_000, maxRunBytes: 5_000_000 };

  it('reads answers until their total passes the run’s budget, then refuses, naming it', async () => {
    const told = vi.fn();
    const runFetch = createRunFetch(answering(2_000_000), new AbortController().signal, limits, ['run'], told);

    await expect((await runFetch('https://a.example/')).arrayBuffer()).resolves.toHaveProperty('byteLength', 2_000_000);
    await expect((await runFetch('https://b.example/')).arrayBuffer()).resolves.toHaveProperty('byteLength', 2_000_000);
    await expect((await runFetch('https://c.example/')).arrayBuffer()).rejects.toThrow(
      'more than its 5000000 byte budget across its requests'
    );
    // Once, so a task that catches the failure and goes on still leaves the ceiling named in the run's trace.
    await expect((await runFetch('https://d.example/')).arrayBuffer()).rejects.toMatchObject({
      reason: 'over_capacity'
    });
    expect(told).toHaveBeenCalledTimes(1);
    expect(told.mock.calls[0]?.[0]).toContain('limits: { maxRunBytes }');
  });

  it('is a budget of the run, not of the process: another run starts from nothing', async () => {
    const first = createRunFetch(answering(2_500_000), new AbortController().signal, limits, ['run-1']);
    const second = createRunFetch(answering(2_500_000), new AbortController().signal, limits, ['run-2']);

    // The first run spends its whole budget, exactly…
    await expect((await first('https://a.example/')).arrayBuffer()).resolves.toBeDefined();
    await expect((await first('https://b.example/')).arrayBuffer()).resolves.toBeDefined();
    // …and the second has all of its own.
    await expect((await second('https://a.example/')).arrayBuffer()).resolves.toBeDefined();
    await expect((await second('https://b.example/')).arrayBuffer()).resolves.toBeDefined();
  });
});
