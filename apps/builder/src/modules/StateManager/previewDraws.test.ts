import { describe, expect, it } from 'vitest';

import { drawnAgain } from './previewDraws';

import type { DeclaredExperiment } from '@plitzi/sdk-shared/experiments';

const declared: Record<string, DeclaredExperiment> = {
  plans: { weights: [50, 25, 20, 5], builderVariant: 'a' },
  hero: { weights: [50, 50], builderVariant: 'a' }
};

describe('a new visitor in the preview', () => {
  it('is drawn each test it draws by its shares, and keeps the variants picked by hand for the others', () => {
    expect(drawnAgain(declared, ['plans'], { hero: 'b', plans: 'a' }, () => 0.9)).toEqual({ hero: 'b', plans: 'c' });
  });

  it('comes out over many visitors in the shares the test is written with', () => {
    const counts: Record<string, number> = {};
    for (let step = 0; step < 1000; step += 1) {
      const variant = drawnAgain(declared, ['plans'], {}, () => (step + 0.5) / 1000).plans;
      counts[variant] = (counts[variant] ?? 0) + 1;
    }

    expect(counts).toEqual({ a: 500, b: 250, c: 200, d: 50 });
  });

  it('draws nothing for a test the space no longer runs', () => {
    expect(drawnAgain(declared, ['gone'], { hero: 'a' })).toEqual({ hero: 'a' });
  });
});
