import { describe, expect, it } from 'vitest';

import { priceOf, turnCost } from './prices';

const turn = { input: 0, cacheRead: 0, cacheWrite: 0, cacheWriteLong: 0, output: 0 };

describe('what a turn costs at the API’s prices', () => {
  it('knows a model by the id each harness writes, and prices none it does not list', () => {
    expect(priceOf('claude-opus-5-5[1m]')).toEqual(priceOf('claude-opus-5-5'));
    expect(priceOf('anthropic/claude-sonnet-5-5')).toEqual(priceOf('claude-sonnet-5-5'));
    expect(priceOf('claude-haiku-4-5-20251001')).toEqual(priceOf('claude-haiku-4-5'));
    expect(priceOf('gpt-5.6-terra')).toBeUndefined();
    expect(priceOf(undefined)).toBeUndefined();
  });

  it('prices cache writes by how long they are kept, and a long Haiku prompt at its own rate', () => {
    const opus = priceOf('claude-opus-5-5');
    const haiku = priceOf('claude-haiku-5-5');
    if (!opus || !haiku) {
      throw new Error('Opus 5.5 and Haiku 5.5 are priced');
    }

    // $4 in: 1M written for five minutes is $5, for an hour $8; 1M read again $0.20; 1M out $20.
    expect(turnCost(opus, { ...turn, cacheWrite: 1_000_000 })).toBeCloseTo(5);
    expect(turnCost(opus, { ...turn, cacheWrite: 1_000_000, cacheWriteLong: 1_000_000 })).toBeCloseTo(8);
    expect(turnCost(opus, { ...turn, cacheRead: 1_000_000, output: 1_000_000 })).toBeCloseTo(20.2);
    expect(turnCost(haiku, { ...turn, input: 100_000 })).toBeCloseTo(0.01);
    expect(turnCost(haiku, { ...turn, input: 200_000 })).toBeCloseTo(0.1);
  });
});
