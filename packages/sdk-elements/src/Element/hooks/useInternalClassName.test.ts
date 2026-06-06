import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import useInternalClassName from './useInternalClassName';

import type { Element } from '@plitzi/sdk-shared';

const makeDefinition = (overrides: Partial<Element['definition']> = {}): Element['definition'] => ({
  rootId: 'root',
  label: 'El',
  type: 'container',
  styleSelectors: { base: 'plitzi__container my-base' },
  ...overrides
});

const render = (props: Partial<Parameters<typeof useInternalClassName>[0]> = {}) =>
  renderHook(() =>
    useInternalClassName({
      id: 'el1',
      className: 'custom',
      previewMode: false,
      baseElementId: 'page',
      definition: makeDefinition(),
      elementState: {},
      ...props
    })
  );

describe('useInternalClassName', () => {
  it('includes the passed className and the base styleSelectors', () => {
    const { result } = render();

    expect(result.current).toContain('custom');
    expect(result.current).toContain('my-base');
  });

  it('adds the hidden class when visibility is false', () => {
    const { result } = render({ elementState: { visibility: false } });

    expect(result.current).toContain('plitzi-component--hidden');
  });

  it('adds the hidden class when visibility is the string "false"', () => {
    const { result } = render({ elementState: { visibility: 'false' } });

    expect(result.current).toContain('plitzi-component--hidden');
  });

  it('marks plitzi-component when not in preview and there is no layout', () => {
    const { result } = render();

    expect(result.current).toContain('plitzi-component');
    expect(result.current).not.toContain('plitzi-component--layout');
  });

  it('omits structural classes in preview mode', () => {
    const { result } = render({ previewMode: true, definition: makeDefinition({ items: [] }) });

    expect(result.current).not.toContain('plitzi-component');
    expect(result.current).not.toContain('with__container');
  });

  it('adds container classes when the element has items', () => {
    const { result } = render({ definition: makeDefinition({ items: ['child'] }) });

    expect(result.current).toContain('with__container');
    expect(result.current).not.toContain('container--empty');
  });

  it('marks an empty container when items is an empty array', () => {
    const { result } = render({ definition: makeDefinition({ items: [] }) });

    expect(result.current).toContain('container--empty');
  });

  it('marks the base element when the id matches baseElementId', () => {
    const { result } = render({ id: 'page', definition: makeDefinition({ items: ['child'] }) });

    expect(result.current).toContain('container--base-element');
  });

  it('marks the layout body when id matches the layout containerId', () => {
    const { result } = render({
      plitziElementLayout: {
        rootId: 'root',
        containerId: 'el1',
        referenceId: 'ref',
        type: 'layout',
        bodyChildren: null
      }
    });

    expect(result.current).toContain('plitzi-component--layout-body');
  });
});
