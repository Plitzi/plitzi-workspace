import { describe, expect, it } from 'vitest';

import { serverProviderSource, serverWhenValues, whenOf, whenProviders, whenUnknownToServer } from './providerWhen';
import { evaluateRuleGroup } from '../helpers/ruleEvaluator';

import type { RuleGroup, RuleValue } from '../helpers/ruleEvaluator';

const group = (...rules: { field: string; value: RuleValue }[]): RuleGroup => ({
  combinator: 'and',
  rules: rules.map(({ field, value }) => ({ field, operator: '=' as const, value }))
});

const flat = { roomData: {}, roomPeople: {}, search: {} };

describe('a provider’s `when`', () => {
  it('is a rule group with a rule in it — anything else waits on nothing', () => {
    expect(whenOf({ attributes: { when: group({ field: 'auth.isAuthenticated', value: true }) } })).toBeDefined();
    expect(whenOf({ attributes: { when: { combinator: 'and', rules: [] } } })).toBeUndefined();
    expect(whenOf({ attributes: { when: 'auth.isAuthenticated' } })).toBeUndefined();
    expect(whenOf({ attributes: {} })).toBeUndefined();
  });

  it('says what the page server cannot know, and the server providers it reads', () => {
    const when = group(
      { field: 'apiContainer_roomData.found', value: true },
      { field: 'auth.isAuthenticated', value: true },
      { field: 'slug', value: 'night' },
      { field: 'state.editing', value: true },
      { field: 'apiContainer_search.query', value: 'a' }
    );
    const server = new Set(['roomData', 'roomPeople']);

    expect(whenUnknownToServer(when, flat, server)).toEqual(['state.editing', 'apiContainer_search.query']);
    expect(whenProviders(when, server)).toEqual(['roomData']);
  });

  it('reads the visit, the visitor and the answers as the browser publishes them', () => {
    const values = serverWhenValues({
      routeParams: { slug: 'night' },
      queryParams: {},
      pageId: 'room',
      user: undefined,
      answers: { roomData: { answer: { found: true, records: [] }, singleRecord: false } }
    });

    expect(
      evaluateRuleGroup(
        group(
          { field: 'apiContainer_roomData.found', value: true },
          { field: 'navigation.routeParams.slug', value: 'night' },
          { field: 'slug', value: 'night' },
          { field: 'auth.isAuthenticated', value: false }
        ),
        values
      )
    ).toBe(true);
    expect(serverProviderSource({ records: [] }, false)).toMatchObject({ isEmpty: true, hasError: false });
    expect(serverProviderSource(undefined, false)).toMatchObject({ hasError: true });
  });
});
