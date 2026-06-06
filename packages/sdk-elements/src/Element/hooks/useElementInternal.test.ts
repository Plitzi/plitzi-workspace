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
      attributes: [{ id: 'b1', source: 'variables', fromPath: 'title', toPath: 'text', enabled: true }]
    });
    const result = getProps(element, internal, { variables: { title: 'Hello' } });

    expect(result.attributes.text).toBe('Hello');
  });

  it('interpolates variable tokens in string attributes', () => {
    const result = getProps(makeElement(undefined, { text: '{{ name }}' }), internal, { variables: { name: 'Bob' } });

    expect(result.attributes.text).toBe('Bob');
  });

  it('merges element state into attributes but keeps visibility in elementState', () => {
    const result = getProps(makeElement(undefined, { text: 'hi' }), internal, {}, { foo: 'bar', visibility: false });

    expect(result.attributes.foo).toBe('bar');
    expect(result.attributes.visibility).toBeUndefined();
    expect(result.elementState.visibility).toBe(false);
  });

  it('lets a binding override a base attribute', () => {
    const element = makeElement(
      { attributes: [{ id: 'b1', source: 'variables', fromPath: 'title', toPath: 'text', enabled: true }] },
      { text: 'original' }
    );
    const result = getProps(element, internal, { variables: { title: 'bound' } });

    expect(result.attributes.text).toBe('bound');
  });
});
