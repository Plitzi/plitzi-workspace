import { describe, expect, it, vi } from 'vitest';

import { requestExperiments } from './experiments';

import type { Element } from '@plitzi/sdk-shared';

const node = (id: string, type: string, attributes: Record<string, unknown>, items: string[] = []): Element => ({
  id,
  attributes,
  definition: { rootId: id, label: type, type, styleSelectors: { base: '' }, items }
});

/** An A/B test whose two variants weigh what is given. */
const abTest = (id: string, experiment: string, [a, b]: [number, number]): Record<string, Element> => ({
  [id]: node(id, 'abTest', { experiment }, [`${id}A`, `${id}B`]),
  [`${id}A`]: node(`${id}A`, 'abTestVariant', { weight: a }),
  [`${id}B`]: node(`${id}B`, 'abTestVariant', { weight: b })
});

const space = (flat: Record<string, Element>) => ({ flat, components: {} });

const request = (cookie?: string, protocol: 'http' | 'https' = 'https') => ({
  headers: { cookie, host: 'site.example.com' },
  protocol
});

describe('requestExperiments', () => {
  const schema = space({ ...abTest('hero', 'heroTest', [50, 50]), ...abTest('price', 'pricing', [0, 100]) });

  it('draws the visitor’s variants and keeps them, secure on https', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.9);

    expect(requestExperiments(request(), schema, true)).toEqual({
      assignments: { heroTest: 'b', pricing: 'b' },
      // An experiment with one variant left with a weight needs nothing kept: everybody sees B.
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
