import { describe, expect, it } from 'vitest';

import {
  parseTyped,
  persistenceOf,
  preview,
  segmentsOf,
  setInState,
  shapeOf,
  statePathsOf,
  subPathsOf,
  topKeysOf,
  valueAt
} from './helpers';

import type { Element, ElementInteraction, Schema } from '@plitzi/sdk-shared';

const element = (
  id: string,
  extra: Partial<Element['definition']> = {},
  attributes: Element['attributes'] = {}
): Element => ({
  id,
  attributes,
  definition: { rootId: 'home', label: id, type: 'container', items: [], styleSelectors: { base: '' }, ...extra }
});

const step = (action: string, params: Record<string, unknown>): ElementInteraction => ({
  id: `s-${action}`,
  title: action,
  type: 'globalCallback',
  action,
  params,
  preview: {},
  elementId: 'state',
  beforeNode: '',
  afterNode: '',
  flowId: 'f',
  enabled: true
});

describe('the state keys a space uses', () => {
  it('names what reads each key and what writes it, a key a component uses too', () => {
    const schema: Pick<Schema, 'flat' | 'components'> = {
      flat: {
        title: element('title', { bindings: { attributes: [{ id: 'b', to: 'content', source: 'state.cart.count' }] } }),
        badge: element('badge', {}, { content: 'You have {{ state.step }} steps' }),
        next: element('next', { interactions: { a: step('setState', { key: 'step', value: 3 }) } }),
        open: element('open', { interactions: { a: step('toggleState', { key: 'state.cartOpen' }) } }),
        dynamic: element('dynamic', { interactions: { a: step('setState', { key: '{{ props.name }}' }) } })
      },
      components: {
        card: {
          id: 'card',
          rootId: 'card-root',
          flat: { 'card-root': element('card-root', {}, { content: '{{ state.cartOpen ? "open" : "" }}' }) }
        }
      }
    };

    const paths = statePathsOf(schema);
    const keys = topKeysOf(paths);

    expect([...keys.keys()].sort()).toEqual(['cart', 'cartOpen', 'step']);
    expect(keys.get('cart')).toEqual({ path: 'cart', reads: ['title'], writes: [], children: ['count'] });
    expect(keys.get('step')).toEqual({ path: 'step', reads: ['badge'], writes: ['next'], children: [] });
    expect(keys.get('cartOpen')).toEqual({ path: 'cartOpen', reads: ['card-root'], writes: ['open'], children: [] });
    expect(paths.get('cart.count')).toEqual({ path: 'cart.count', reads: ['title'], writes: [], children: [] });
  });

  it('counts a use under a key for the key, and names the deepest paths under it', () => {
    const schema: Pick<Schema, 'flat' | 'components'> = {
      flat: {
        name: element('name', {}, { content: '{{ state.cart.items[0].name }}' }),
        total: element('total', { interactions: { a: step('setState', { key: 'cart.total', value: 3 }) } })
      },
      components: {}
    };

    const paths = statePathsOf(schema);

    expect(paths.get('cart')).toMatchObject({ reads: ['name'], writes: ['total'], children: ['items', 'total'] });
    expect(paths.get('cart.items.0')?.children).toEqual(['name']);
    expect(subPathsOf(paths, 'cart').map(use => [use.path, use.reads, use.writes])).toEqual([
      ['cart.items.0.name', ['name'], []],
      ['cart.total', [], ['total']]
    ]);
  });
});

describe('a path into the state', () => {
  it('names its keys, and stops at a template', () => {
    expect(segmentsOf('state.cart.items[0].name')).toEqual(['cart', 'items', '0', 'name']);
    expect(segmentsOf("runtime.state.cart['total']")).toEqual(['cart', 'total']);
    expect(segmentsOf('cart.{{ props.key }}')).toEqual(['cart']);
    expect(segmentsOf('cart.item{{ i }}')).toEqual(['cart']);
    expect(segmentsOf('cart[{{ i }}].done')).toEqual(['cart']);
    expect(segmentsOf('{{ props.name }}')).toEqual([]);
  });

  it('reads and writes one path, copying what is on the way', () => {
    const state = { cart: { items: [{ name: 'tea' }], total: 2 }, step: 1 };
    const next = setInState(state, ['cart', 'items', '0', 'name'], 'coffee');

    expect(valueAt(next, ['cart', 'items', '0', 'name'])).toBe('coffee');
    expect(Array.isArray(valueAt(next, ['cart', 'items']))).toBe(true);
    expect(state.cart.items[0].name).toBe('tea');
    expect(next.step).toBe(1);
    expect(setInState({}, ['filters', 'status'], 'open')).toEqual({ filters: { status: 'open' } });
  });

  it('says what a branch holds', () => {
    expect(shapeOf([1, 2])).toBe('[2]');
    expect(shapeOf({ a: 1 })).toBe('{1}');
    expect(shapeOf(3)).toBeUndefined();
  });
});

describe('what the settings keep of a key', () => {
  const settings = (extra: Partial<Schema['settings']>) => ({ ...extra }) as Schema['settings'];

  it('keeps nothing without keepState', () => {
    expect(persistenceOf(settings({}), 'step').kept).toBe(false);
  });

  it('keeps every key but a transient one, or only those keptState names', () => {
    expect(persistenceOf(settings({ keepState: true }), 'step').kept).toBe(true);
    expect(persistenceOf(settings({ keepState: true, transientState: ['step'] }), 'step').kept).toBe(false);
    expect(persistenceOf(settings({ keepState: true, keptState: ['cart'] }), 'step').kept).toBe(false);
    expect(persistenceOf(settings({ keepState: true, keptState: ['cart'] }), 'cart').kept).toBe(true);
  });

  it('says a painted and a browser key', () => {
    const kept = persistenceOf(settings({ keepState: true, paintedState: ['ws'], browserState: ['ws'] }), 'ws');

    expect(kept).toMatchObject({ kept: true, painted: true, browser: true });
  });
});

describe('a typed value', () => {
  it('reads JSON as itself and anything else as words', () => {
    expect(parseTyped('3')).toBe(3);
    expect(parseTyped('true')).toBe(true);
    expect(parseTyped('[1,2]')).toEqual([1, 2]);
    expect(parseTyped('hello')).toBe('hello');
  });

  it('previews a value in a line', () => {
    expect(preview(undefined)).toBe('—');
    expect(preview('a')).toBe('"a"');
    expect(preview({ a: 'x'.repeat(80) }).endsWith('…')).toBe(true);
  });
});
