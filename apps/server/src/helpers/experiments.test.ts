import { describe, expect, it, vi } from 'vitest';

import { requestExperiments } from './experiments';

import type { Element } from '@plitzi/sdk-shared';

const abTest = (id: string, experiment: string, split: number): Element => ({
  id,
  attributes: { experiment, split },
  definition: { rootId: id, label: 'A/B Test', type: 'abTest', styleSelectors: { base: '' } }
});

const space = (flat: Record<string, Element>) => ({ flat, components: {} });

const request = (cookie?: string, protocol: 'http' | 'https' = 'https') => ({
  headers: { cookie, host: 'site.example.com' },
  protocol
});

describe('requestExperiments', () => {
  const schema = space({ hero: abTest('hero', 'heroTest', 50), price: abTest('price', 'pricing', 100) });

  it('draws the visitor’s variants and keeps them, secure on https', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.1);

    expect(requestExperiments(request(), schema, true)).toEqual({
      assignments: { heroTest: 'b', pricing: 'b' },
      // An experiment ended at 100 needs nothing kept: everybody sees B.
      setCookie: 'plitzi_ab=heroTest%3Ab; Path=/; Max-Age=15552000; SameSite=Lax; Secure'
    });
  });

  it('draws nothing for a visitor who kept every variant, so their page may be kept for whoever keeps the same', () => {
    expect(requestExperiments(request('plitzi_ab=heroTest%3Aa'), schema, true)).toEqual({
      assignments: { heroTest: 'a', pricing: 'b' }
    });
  });

  it('draws and keeps nothing for a render nobody visits: what is not kept is A', () => {
    expect(requestExperiments(request(), schema, false)).toEqual({ assignments: { heroTest: 'a', pricing: 'b' } });
  });

  it('answers nothing for a space that runs no experiment', () => {
    expect(requestExperiments(request(), space({}), true)).toEqual({ assignments: {} });
    expect(requestExperiments(request(), undefined, true)).toEqual({ assignments: {} });
  });
});
