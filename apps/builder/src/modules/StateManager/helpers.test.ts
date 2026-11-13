import { describe, expect, it } from 'vitest';

import { parseTyped, persistenceOf, preview, stateKeysOf } from './helpers';

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

    const keys = stateKeysOf(schema);

    expect([...keys.keys()].sort()).toEqual(['cart', 'cartOpen', 'step']);
    expect(keys.get('cart')).toEqual({ key: 'cart', reads: ['title'], writes: [] });
    expect(keys.get('step')).toEqual({ key: 'step', reads: ['badge'], writes: ['next'] });
    expect(keys.get('cartOpen')).toEqual({ key: 'cartOpen', reads: ['card-root'], writes: ['open'] });
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
