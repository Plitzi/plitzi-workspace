import { describe, it, expect } from 'vitest';

import { getProps } from './useElementInternal';

import type { Element, InternalPropsSTG1 } from '@plitzi/sdk-shared';

const makeElement = (
  bindings?: Element['definition']['bindings'],
  attributes: Record<string, unknown> = {}
): Element => ({
  id: 'el1',
  attributes,
  definition: {
    rootId: 'root',
    label: 'El',
    type: 'text',
    styleSelectors: { base: 'el1' },
    bindings
  }
});

const internal: InternalPropsSTG1 = { id: 'el1', rootId: 'root' };

describe('getProps (element resolution)', () => {
  it('keeps base attributes and parses styleSelectors when there is no dataSource or state', () => {
    const result = getProps(makeElement(undefined, { text: 'hi' }), internal);

    expect(result.attributes.text).toBe('hi');
    expect(result.definition.styleSelectors.base).toContain('el1');
  });

  it('resolves an attribute binding from the dataSource map', () => {
    const element = makeElement({
      attributes: [{ id: 'b1', source: 'variables.title', to: 'text', enabled: true }]
    });
    const result = getProps(element, internal, { variables: { title: 'Hello' } });

    expect(result.attributes.text).toBe('Hello');
  });

  it('resolves a text element content binding from runtime state', () => {
    const element = makeElement(
      { attributes: [{ id: 'b1', source: 'state.genre', to: 'content', enabled: true }] },
      { content: 'All genres' }
    );
    const result = getProps(element, internal, { state: { genre: 'Arcade' } });

    // Declarations use `bindings` for builder metadata; resolution itself is generic and reaches native elements too.
    expect(result.attributes.content).toBe('Arcade');
  });

  it('interpolates variable tokens in string attributes', () => {
    const result = getProps(makeElement(undefined, { text: '{{ name }}' }), internal, { variables: { name: 'Bob' } });

    expect(result.attributes.text).toBe('Bob');
  });

  it('resolves a token naming a source the element reads — a list row, the state, the current page', () => {
    const result = getProps(
      makeElement(undefined, {
        href: '/games/{{ list_games.item.slug }}',
        content: '{{ state.callsign|upper }} on {{ navigation.currentPageId }}'
      }),
      internal,
      {
        list_games: { item: { slug: 'nebula-run' }, index: '0' },
        state: { callsign: 'kestrel' },
        navigation: { currentPageId: 'arcade' },
        routeParams: {}
      }
    );

    expect(result.attributes.href).toBe('/games/nebula-run');
    expect(result.attributes.content).toBe('KESTREL on arcade');
  });

  it('prints a template that arrived as bound DATA instead of evaluating it', () => {
    const element = makeElement(
      { attributes: [{ id: 'b1', source: 'list_comments.item.body', to: 'content', enabled: true }] },
      { content: '' }
    );
    const result = getProps(element, internal, {
      list_comments: { item: { body: '{{ auth.accessToken }}' } },
      auth: { accessToken: 'secret' }
    });

    expect(result.attributes.content).toBe('{{ auth.accessToken }}');
  });

  it('merges element state into attributes but keeps visibility in elementState', () => {
    const result = getProps(makeElement(undefined, { text: 'hi' }), internal, {}, { foo: 'bar', visibility: false });

    expect(result.attributes.foo).toBe('bar');
    expect(result.attributes.visibility).toBeUndefined();
    expect(result.elementState.visibility).toBe(false);
  });

  it('lets a binding override a base attribute', () => {
    const element = makeElement(
      { attributes: [{ id: 'b1', source: 'variables.title', to: 'text', enabled: true }] },
      { text: 'original' }
    );
    const result = getProps(element, internal, { variables: { title: 'bound' } });

    expect(result.attributes.text).toBe('bound');
  });

  it('injects attributes carried on internalProps over the element attributes', () => {
    const result = getProps(makeElement(undefined, { text: 'base', color: 'red' }), {
      ...internal,
      attributes: { color: 'blue' }
    });

    expect(result.attributes.text).toBe('base');
    expect(result.attributes.color).toBe('blue');
  });

  it('overrides rootId from plitziElementLayout when present', () => {
    const result = getProps(makeElement(undefined, { text: 'hi' }), {
      ...internal,
      plitziElementLayout: {
        rootId: 'layoutRoot',
        containerId: 'c1',
        type: 'layout'
      }
    });

    expect(result.rootId).toBe('layoutRoot');
  });

  it('merges state.styleSelectors into the definition styleSelectors and keeps them out of attributes', () => {
    const result = getProps(
      makeElement(undefined, { text: 'hi' }),
      internal,
      {},
      { styleSelectors: { hover: 'hovered' } }
    );

    expect(result.definition.styleSelectors.hover).toContain('hovered');
    expect(result.attributes.styleSelectors).toBeUndefined();
  });
});
