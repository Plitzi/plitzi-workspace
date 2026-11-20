import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveFlags } from './resolveFlags';
import {
  assignRollout,
  browserRollout,
  keptRollout,
  parseRolloutList,
  rolledOutFlags,
  rolloutCookie,
  rolloutCookieName,
  serializeRolloutList
} from './rollout';
import { isSchemaFlag } from './schemaFlag';

import type { Schema } from '../types';

const flags: Schema['flags'] = {
  newCheckout: { value: false, rules: [], rollout: { percent: 30, value: true } },
  everybody: { value: false, rules: [], rollout: { percent: 100, value: true } },
  nobody: { value: false, rules: [], rollout: { percent: 0, value: true } },
  plain: { value: true, rules: [] }
};

describe('a gradual rollout', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is a shape every writer checks: a whole share from 0 to 100 and the answer it gives', () => {
    expect(isSchemaFlag({ value: false, rules: [], rollout: { percent: 30, value: true } })).toBe(true);
    expect(isSchemaFlag({ value: false, rules: [], rollout: { percent: 130, value: true } })).toBe(false);
    expect(isSchemaFlag({ value: false, rules: [], rollout: { percent: 3.5, value: true } })).toBe(false);
    expect(isSchemaFlag({ value: false, rules: [], rollout: { percent: 30 } })).toBe(false);
  });

  it('needs a place only where it splits the visitors', () => {
    expect(rolledOutFlags(flags)).toEqual(['newCheckout']);
  });

  it('takes in the places below its percent, and answers its flag’s value to the rest and to a visitor with none', () => {
    const answer = (place?: number) =>
      resolveFlags(flags, place === undefined ? {} : { rollout: { newCheckout: place } }).newCheckout;

    expect(answer(29)).toEqual({ value: true, layer: 'space', rollout: true });
    expect(answer(30)).toEqual({ value: false, layer: 'space', rollout: true });
    expect(answer()).toEqual({ value: false, layer: 'space' });
    expect(resolveFlags(flags).everybody).toEqual({ value: true, layer: 'space', rollout: true });
    expect(resolveFlags(flags, { rollout: { nobody: 0 } }).nobody).toEqual({
      value: false,
      layer: 'space',
      rollout: true
    });
  });

  it('comes after the rules: a rule that matches answers first', () => {
    const ruled: Schema['flags'] = {
      newCheckout: {
        value: false,
        rules: [
          {
            when: { combinator: 'and', rules: [{ field: 'environment', operator: '=', value: 'staging' }] },
            value: false
          }
        ],
        rollout: { percent: 100, value: true }
      }
    };

    expect(resolveFlags(ruled, { environment: 'staging' }).newCheckout).toEqual({
      value: false,
      layer: 'space',
      rule: 0
    });
  });

  it('keeps a visitor’s place, and draws one for a flag they have none of', () => {
    expect(assignRollout(flags, { newCheckout: 12 })).toEqual({ buckets: { newCheckout: 12 }, drawn: [] });
    expect(assignRollout(flags, {}, () => 0.999)).toEqual({ buckets: { newCheckout: 99 }, drawn: ['newCheckout'] });
  });

  it('draws a place once per page, whoever in the browser asks', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.42).mockReturnValueOnce(0.9);
    const draws = { pageOnly: { value: false, rules: [], rollout: { percent: 50, value: true } } };

    expect(browserRollout(draws, undefined)).toEqual({ buckets: { pageOnly: 42 }, drawn: ['pageOnly'] });
    expect(browserRollout(draws, undefined)).toEqual({ buckets: { pageOnly: 42 }, drawn: [] });
    expect(browserRollout(draws, { pageOnly: 7 }).buckets).toEqual({ pageOnly: 7 });
  });

  it('is kept in a cookie of its own, named for the port, in one order', () => {
    expect(rolloutCookieName('localhost:4013')).toBe('plitzi_rollout_4013');
    expect(serializeRolloutList({ zeta: 3, alpha: 70 })).toBe('alpha:70,zeta:3');
    expect(parseRolloutList('alpha:70,bad:100,neg:-1,frac:1.5,empty:,bad name:3,x')).toEqual({ alpha: 70 });
    expect(keptRollout('a=b; plitzi_rollout=alpha%3A70', 'example.com')).toEqual({ alpha: 70 });
    expect(rolloutCookie('example.com', { alpha: 70 }, { secure: true })).toBe(
      'plitzi_rollout=alpha%3A70; Path=/; Max-Age=15552000; SameSite=Lax; Secure'
    );
  });
});
