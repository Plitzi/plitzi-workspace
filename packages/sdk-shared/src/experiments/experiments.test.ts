import { describe, expect, it } from 'vitest';

import { assignExperiments, builderExperiments, declaredExperiments } from './experiments';
import {
  experimentsCookie,
  experimentsCookieName,
  keptExperiments,
  parseExperimentList,
  serializeExperimentList
} from './experimentsCookie';

import type { DeclaredExperiment } from './experiments';
import type { Element } from '../types';

const element = (
  id: string,
  type: string,
  attributes: Record<string, unknown> = {},
  items: string[] = []
): Element => ({
  id,
  attributes,
  definition: { rootId: id, label: type, type, styleSelectors: { base: '' }, items }
});

/** An A/B test and its variants, each with the weight given (`undefined`: none written). */
const test = (id: string, attributes: Record<string, unknown>, weights: (number | string | undefined)[]) => {
  const flat: Record<string, Element> = {};
  const ids = weights.map((weight, index) => {
    const variantId = `${id}-${String(index)}`;
    flat[variantId] = element(variantId, 'abTestVariant', weight === undefined ? {} : { weight });

    return variantId;
  });
  flat[id] = element(id, 'abTest', attributes, ids);

  return flat;
};

describe('the experiments a space runs', () => {
  it('are its abTest elements by name, on its pages and in its components, the first naming one giving the weights', () => {
    const flat = {
      ...test('hero', { experiment: 'heroTest', builderVariant: 'b' }, [70, 30]),
      ...test('again', { experiment: 'heroTest' }, [10, 90]),
      ...test('unnamed', { experiment: '' }, [50, 50]),
      ...test('badName', { experiment: 'hero test' }, [50, 50]),
      plain: element('plain', 'container', { experiment: 'notOne' })
    };
    const components = {
      card: {
        id: 'card',
        rootId: 'price',
        flat: test('price', { experiment: 'pricing', builderVariant: 'e' }, [undefined, 'many', 20])
      }
    };

    expect(declaredExperiments({ flat, components })).toEqual({
      heroTest: { weights: [70, 30], builderVariant: 'b' },
      // An unreadable weight is the default, and the canvas cannot show a variant the test does not have.
      pricing: { weights: [50, 50, 20], builderVariant: 'a' }
    });
  });
});

describe('assigning a visitor', () => {
  const declared: Record<string, DeclaredExperiment> = {
    heroTest: { weights: [70, 30], builderVariant: 'a' },
    pricing: { weights: [20, 30, 50], builderVariant: 'c' }
  };
  const shares = (draw: number) => assignExperiments(declared, {}, () => draw).assignments;

  it('draws a variant for each experiment the visitor has none of, in proportion to the weights', () => {
    expect(shares(0)).toEqual({ heroTest: 'a', pricing: 'a' });
    expect(shares(0.69)).toEqual({ heroTest: 'a', pricing: 'c' });
    expect(shares(0.7)).toEqual({ heroTest: 'b', pricing: 'c' });
    expect(shares(0.3)).toEqual({ heroTest: 'a', pricing: 'b' });
    expect(assignExperiments(declared, {}, () => 0.5)).toMatchObject({ drawn: ['heroTest', 'pricing'] });
  });

  it('keeps what the visitor was shown, whatever the weights are now, and draws nothing for it', () => {
    expect(assignExperiments(declared, { heroTest: 'b', pricing: 'c' }, () => 0)).toEqual({
      assignments: { heroTest: 'b', pricing: 'c' },
      kept: { heroTest: 'b', pricing: 'c' },
      drawn: []
    });
  });

  it('draws again a visitor whose variant was taken out (weight 0), or is not there any more', () => {
    const narrowed: Record<string, DeclaredExperiment> = {
      pricing: { weights: [50, 0, 50], builderVariant: 'a' }
    } as const;

    expect(assignExperiments(narrowed, { pricing: 'b' }, () => 0.9)).toEqual({
      assignments: { pricing: 'c' },
      kept: { pricing: 'c' },
      drawn: ['pricing']
    });
    expect(assignExperiments(narrowed, { pricing: 'e' }, () => 0).drawn).toEqual(['pricing']);
  });

  it('shows everybody the one variant left with a weight, A when none has any, and keeps nothing of it', () => {
    const ended: Record<string, DeclaredExperiment> = {
      heroTest: { weights: [0, 100], builderVariant: 'a' },
      pricing: { weights: [0, 0, 0], builderVariant: 'a' }
    };

    expect(assignExperiments(ended, { heroTest: 'a', pricing: 'b' })).toEqual({
      assignments: { heroTest: 'b', pricing: 'a' },
      kept: {},
      drawn: []
    });
  });

  it('forgets a variant of an experiment the space no longer runs', () => {
    expect(assignExperiments({}, { gone: 'b' }).kept).toEqual({});
  });

  it('shows the builder the variant each experiment’s settings name', () => {
    expect(builderExperiments(declared)).toEqual({ heroTest: 'a', pricing: 'c' });
  });
});

describe('the experiments cookie', () => {
  it('is named for the port, like the flags a tester forces', () => {
    expect(experimentsCookieName('localhost:4013')).toBe('plitzi_ab_4013');
    expect(experimentsCookieName('example.com')).toBe('plitzi_ab');
  });

  it('round-trips the variants, in one order whatever order they were drawn in', () => {
    expect(serializeExperimentList({ pricing: 'a', heroTest: 'b' })).toBe('heroTest:b,pricing:a');
    expect(parseExperimentList('heroTest:b,pricing:a')).toEqual({ heroTest: 'b', pricing: 'a' });
  });

  it('keeps nothing that is not a name and a variant', () => {
    expect(parseExperimentList('ok:b,bad name:a,also:f,__proto__:a,x')).toEqual({ ok: 'b' });
    expect(parseExperimentList(undefined)).toEqual({});
  });

  it('is read from a Cookie header', () => {
    expect(keptExperiments('a=b; plitzi_ab_5000=heroTest%3Ab', 'localhost:5000')).toEqual({ heroTest: 'b' });
  });

  it('is written for the whole site, for months, secure where the page is', () => {
    expect(experimentsCookie('example.com', { heroTest: 'b' }, { secure: true })).toBe(
      'plitzi_ab=heroTest%3Ab; Path=/; Max-Age=15552000; SameSite=Lax; Secure'
    );
    expect(experimentsCookie('localhost:3000', { heroTest: 'a' }, { secure: false })).toBe(
      'plitzi_ab_3000=heroTest%3Aa; Path=/; Max-Age=15552000; SameSite=Lax'
    );
  });
});
