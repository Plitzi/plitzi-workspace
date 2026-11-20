import { describe, expect, it } from 'vitest';

import {
  forcedExperimentsCookieName,
  forcedExperimentsFor,
  forcedExperimentsOf,
  withForcedExperiment
} from './forcedExperiments';

import type { DeclaredExperiment } from './experiments';

describe('forcing a variant', () => {
  it('is kept in a cookie of its own, named for the port', () => {
    expect(forcedExperimentsCookieName('localhost:4013')).toBe('plitzi_ab_qa_4013');
    expect(forcedExperimentsCookieName('example.com')).toBe('plitzi_ab_qa');
  });

  it('reads the cookie, and an address’s ?ab= over it', () => {
    expect(forcedExperimentsOf('plitzi_ab_qa=heroTest%3Ab%2Cpricing%3Aa', 'example.com', 'pricing:c')).toEqual({
      heroTest: 'b',
      pricing: 'c'
    });
    expect(forcedExperimentsOf(undefined, 'example.com', ['pricing:c'])).toEqual({});
  });

  it('forces one and stops forcing it', () => {
    expect(withForcedExperiment({ heroTest: 'b' }, 'pricing', 'c')).toEqual({ heroTest: 'b', pricing: 'c' });
    expect(withForcedExperiment({ heroTest: 'b' }, 'heroTest', undefined)).toEqual({});
  });

  it('applies only an experiment the space runs and a variant its test has, and says why of the rest', () => {
    const declared: Record<string, DeclaredExperiment> = { heroTest: { weights: [50, 50], builderVariant: 'a' } };

    expect(forcedExperimentsFor(declared, { heroTest: 'b', pricing: 'a' })).toEqual({
      applied: { heroTest: 'b' },
      ignored: [{ name: 'pricing', variant: 'a', reason: 'undeclared' }]
    });
    expect(forcedExperimentsFor(declared, { heroTest: 'c' })).toEqual({
      applied: {},
      ignored: [{ name: 'heroTest', variant: 'c', reason: 'no-such-variant' }]
    });
  });
});
