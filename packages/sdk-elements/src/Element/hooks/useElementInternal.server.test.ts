// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { getProps } from './useElementInternal';

import type { Element, InternalPropsSTG1 } from '@plitzi/sdk-shared';

const element: Element = {
  id: 'card',
  attributes: { content: 'Hi {{ name }}' },
  definition: {
    rootId: 'root',
    label: 'Card',
    type: 'text',
    styleSelectors: { base: 'card-base' },
    bindings: { attributes: [{ id: 'b1', source: 'variables.color', to: 'color', enabled: true }] }
  }
};

const internal: InternalPropsSTG1 = { id: 'card', rootId: 'root' };

// The page server draws the same schema objects on every request: what an element draws with is worked out once.
describe('an element drawn on the server, again', () => {
  it('draws with the definition it drew with before, while nothing at render time changes it', () => {
    const first = getProps(element, internal, { variables: { name: 'Ana' } });
    const again = getProps(element, internal, { variables: { name: 'Bea' } });

    expect(again.definition).toBe(first.definition);
    expect(again.definition.styleSelectors.base).toBe('plitzi__text card-base');
    expect([first.attributes.content, again.attributes.content]).toEqual(['Hi Ana', 'Hi Bea']);
  });

  it('draws a definition of its own when its state names selectors, and leaves the kept one as it was', () => {
    const kept = getProps(element, internal, {}).definition;
    const selected = getProps(element, internal, {}, { styleSelectors: { base: 'is-open' } }).definition;

    expect(selected).not.toBe(kept);
    expect(selected.styleSelectors.base).toBe('plitzi__text is-open');
    expect(getProps(element, internal, {}).definition.styleSelectors.base).toBe('plitzi__text card-base');
  });

  it('keeps none a binding made', () => {
    const styled: Element = {
      ...element,
      definition: {
        ...element.definition,
        bindings: { initialState: [{ id: 'b2', source: 'variables.open', to: 'visibility', enabled: true }] }
      }
    };
    const closed = getProps(styled, internal, { variables: { open: false } }).definition;
    const open = getProps(styled, internal, { variables: { open: true } }).definition;

    expect(closed.initialState?.visibility).toBe(false);
    expect(open.initialState?.visibility).toBe(true);
    expect(getProps(styled, internal, { variables: {} }).definition.initialState?.visibility).toBeUndefined();
  });
});
