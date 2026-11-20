import { describe, expect, it } from 'vitest';

import { assignExperiments, builderExperiments, declaredExperiments, experimentAssignmentsOf } from './experiments';
import {
  experimentsCookie,
  experimentsCookieName,
  keptExperiments,
  parseExperimentList,
  serializeExperimentList
} from './experimentsCookie';

import type { Element } from '../types';

const element = (id: string, type: string, attributes: Record<string, unknown> = {}): Element => ({
  id,
  attributes,
  definition: { rootId: id, label: type, type, styleSelectors: { base: '' } }
});

describe('the experiments a space runs', () => {
  it('are its abTest elements by name, on its pages and in its components, the first naming one giving the split', () => {
    const flat = {
      hero: element('hero', 'abTest', { experiment: 'heroTest', split: 30, builderVariant: 'b' }),
      again: element('again', 'abTest', { experiment: 'heroTest', split: 80 }),
      plain: element('plain', 'container', { experiment: 'notOne' }),
      unnamed: element('unnamed', 'abTest', { experiment: '' }),
      badName: element('badName', 'abTest', { experiment: 'hero test' })
    };
    const components = {
      card: {
        id: 'card',
        rootId: 'price',
        flat: { price: element('price', 'abTest', { experiment: 'pricing', split: 'many' }) }
      }
    };

    expect(declaredExperiments({ flat, components })).toEqual({
      heroTest: { split: 30, builderVariant: 'b' },
      // An unreadable split is the default: half the visitors; the canvas shows A unless told otherwise.
      pricing: { split: 50, builderVariant: 'a' }
    });
  });
});

describe('assigning a visitor', () => {
  const declared = {
    heroTest: { split: 30, builderVariant: 'a' },
    pricing: { split: 50, builderVariant: 'b' }
  } as const;

  it('draws a variant for each experiment the visitor has none of, B below the split', () => {
    expect(assignExperiments(declared, {}, () => 0.29)).toEqual({
      assignments: { heroTest: 'b', pricing: 'b' },
      kept: { heroTest: 'b', pricing: 'b' },
      drawn: ['heroTest', 'pricing']
    });
    expect(assignExperiments(declared, {}, () => 0.3).assignments).toEqual({ heroTest: 'a', pricing: 'b' });
  });

  it('keeps what the visitor was shown, whatever the split is now, and draws nothing for it', () => {
    expect(assignExperiments(declared, { heroTest: 'b' }, () => 0.99)).toEqual({
      assignments: { heroTest: 'b', pricing: 'a' },
      kept: { heroTest: 'b', pricing: 'a' },
      drawn: ['pricing']
    });
  });

  it('shows everybody one side of an experiment ended at 0 or 100, and keeps nothing of it', () => {
    const ended = {
      heroTest: { split: 0, builderVariant: 'b' },
      pricing: { split: 100, builderVariant: 'a' }
    } as const;

    expect(assignExperiments(ended, { heroTest: 'b', pricing: 'a' })).toEqual({
      assignments: { heroTest: 'a', pricing: 'b' },
      kept: {},
      drawn: []
    });
  });

  it('forgets a variant of an experiment the space no longer runs', () => {
    expect(assignExperiments({}, { gone: 'b' }).kept).toEqual({});
  });

  it('shows the builder the variant each experiment’s settings name', () => {
    expect(builderExperiments(declared)).toEqual({ heroTest: 'a', pricing: 'b' });
  });

  it('reads assignments handed in only where each is a name and a variant', () => {
    expect(experimentAssignmentsOf({ heroTest: 'b', other: 'c', 'bad name': 'a' })).toEqual({ heroTest: 'b' });
    expect(experimentAssignmentsOf('heroTest')).toEqual({});
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
    expect(parseExperimentList('ok:b,bad name:a,also:c,__proto__:a,x')).toEqual({ ok: 'b' });
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
