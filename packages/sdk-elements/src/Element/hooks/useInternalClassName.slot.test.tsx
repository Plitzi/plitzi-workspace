import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import useInternalClassName from './useInternalClassName';
import LayoutBody from '../LayoutBody';

import type { Element, ElementLayout } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

const definition: Element['definition'] = {
  rootId: 'root',
  label: 'Slot',
  type: 'container',
  styleSelectors: { base: 'plitzi__container' },
  items: []
};

const classOf = (body: ReactNode, layout: ElementLayout, previewMode = true) =>
  renderHook(
    () =>
      useInternalClassName({
        id: 'plate-action',
        previewMode,
        definition,
        elementState: {},
        plitziElementLayout: layout
      }),
    { wrapper: ({ children }) => <LayoutBody bodies={{ 'plate-action': body }}>{children}</LayoutBody> }
  ).result.current;

const component: ElementLayout = { slots: ['plate-action'], rootId: 'plate', type: 'component' };

// A show plate whose instance put nothing in its action slot kept an empty box there, and the flex gap above it.
describe('a component slot the instance leaves empty', () => {
  it('draws as hidden on the page — and only then', () => {
    expect(classOf(null, component)).toContain('plitzi-component--hidden');
    expect(classOf(<span>Remind me</span>, component)).not.toContain('plitzi-component--hidden');
    // In the builder it is where an author drops into.
    expect(classOf(null, component, false)).not.toContain('plitzi-component--hidden');
    // A layout's slot holds the page: never hidden for it.
    expect(classOf(null, { ...component, type: 'layout' })).not.toContain('plitzi-component--hidden');
  });
});
