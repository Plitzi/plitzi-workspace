import { describe, expect, it } from 'vitest';

import { sameVariants, withDraws } from './previewDraws';

import type { DeclaredExperiment } from '@plitzi/sdk-shared/experiments';

const declared: Record<string, DeclaredExperiment> = {
  plans: { weights: [50, 25, 20, 5], builderVariant: 'a' },
  hero: { weights: [50, 50], builderVariant: 'a' }
};

describe('the variants the preview shows', () => {
  it('draws every test with none yet by its shares, and keeps what it shows already, as a reload does', () => {
    expect(withDraws(declared, {}, [], { random: () => 0.9 })).toEqual({ plans: 'c', hero: 'b' });
    expect(withDraws(declared, { plans: 'd' }, [], { random: () => 0 })).toEqual({ plans: 'd', hero: 'a' });
  });

  it('draws them all again for a new visitor, but the ones picked by hand', () => {
    expect(withDraws(declared, { plans: 'd', hero: 'b' }, ['hero'], { fresh: true, random: () => 0.6 })).toEqual({
      plans: 'b',
      hero: 'b'
    });
  });

  it('comes out over many new visitors in the shares the test is written with', () => {
    const counts: Record<string, number> = {};
    for (let step = 0; step < 1000; step += 1) {
      const { plans } = withDraws(declared, {}, ['hero'], { fresh: true, random: () => (step + 0.5) / 1000 });
      counts[plans] = (counts[plans] ?? 0) + 1;
    }

    expect(counts).toEqual({ a: 500, b: 250, c: 200, d: 50 });
  });

  it('leaves out a test the space no longer runs', () => {
    expect(withDraws(declared, { gone: 'b', plans: 'a', hero: 'a' }, [])).toEqual({ plans: 'a', hero: 'a' });
    expect(sameVariants({ plans: 'a' }, { plans: 'a' })).toBe(true);
    expect(sameVariants({ plans: 'a' }, { plans: 'b' })).toBe(false);
  });
});
