import { describe, expect, it, vi } from 'vitest';

import { jobInput, world } from './tests/jobWorld';
import { wakingQueue } from './wake';

import type { JobWake } from '../../types';

/** One process's pub/sub: what a deployment's Redis is between replicas. */
const inProcessWake = (): JobWake & { notices: () => number } => {
  const listeners = new Set<() => void>();
  let notices = 0;

  return {
    notify: () => {
      notices += 1;
      listeners.forEach(listener => {
        listener();
      });
    },
    listen: listener => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    notices: () => notices
  };
};

/**
 * A worker found a new job only by looking, every `pollMs`: an idle stack started a scheduled action half a second late
 * on average, with nothing else to do. Told as it is enqueued, it takes it then.
 */
describe('a job due now', () => {
  it('is taken as it is enqueued when the workers are told, not on their next look', async () => {
    const wake = inProcessWake();
    const seen = vi.fn(() => ({ ok: true }));
    const test = world(seen);
    // A look a minute apart: only the notice can start it within the test.
    const worker = test.worker({ pollMs: 60_000, wake });
    worker.start();
    try {
      await wakingQueue(test.queue, wake).enqueue(jobInput());

      await vi.waitFor(
        () => {
          expect(seen).toHaveBeenCalledTimes(1);
        },
        { timeout: 2000 }
      );
    } finally {
      await worker.stop();
    }
  });

  it('tells the workers as one is handed back due, and not of one put off', async () => {
    const wake = inProcessWake();
    const test = world(() => ({ ok: true }));
    const queue = wakingQueue(test.queue, wake);
    await queue.enqueue(jobInput());
    expect(wake.notices()).toBe(1);

    const [claimed] = await test.queue.claim({ workerId: 'pod-a', leaseMs: 1_000, limit: 1 });
    await queue.settle({ jobId: claimed.id, workerId: 'pod-a', status: 'pending', refund: true });
    expect(wake.notices()).toBe(2);

    const [again] = await test.queue.claim({ workerId: 'pod-a', leaseMs: 1_000, limit: 1 });
    await queue.settle({ jobId: again.id, workerId: 'pod-a', status: 'pending', delayMs: 30_000 });
    expect(wake.notices()).toBe(2);
  });
});
