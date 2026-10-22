import { describe, expect, it } from 'vitest';

import { inTurns } from './inTurns';

// The sanity run's look: 25 s, 22 of them its commands waiting in turn for each other.
describe('a look’s commands, a few at a time', () => {
  it('runs no more than the limit at once, and answers in the order given', async () => {
    let running = 0;
    let most = 0;
    const job = (value: number, ms: number) => async () => {
      running += 1;
      most = Math.max(most, running);
      await new Promise(resolve => setTimeout(resolve, ms));
      running -= 1;

      return value;
    };

    expect(await inTurns([job(1, 30), job(2, 5), job(3, 10), job(4, 1)], 2)).toEqual([1, 2, 3, 4]);
    expect(most).toBe(2);
    expect(await inTurns([], 3)).toEqual([]);
  });
});
