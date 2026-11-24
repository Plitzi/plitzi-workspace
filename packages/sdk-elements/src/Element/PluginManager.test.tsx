import { render } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ComponentContext } from '@plitzi/sdk-shared/elements';
import { PluginsContext } from '@plitzi/sdk-shared/plugins/react';

import PluginManager from './PluginManager';

import type { ComponentContextValue, ElementLayout, InternalPropsSTG0, PluginsContextValue } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

const handed = vi.hoisted(() => [] as unknown[]);

vi.mock('./helpers/pluginSelector', () => ({
  default: ({ internalProps }: { internalProps: unknown }) => {
    handed.push(internalProps);

    return null;
  }
}));

const pluginsValue = (): PluginsContextValue => ({
  plugins: {},
  registerCustomAssets: () => undefined,
  unregisterCustomAssets: () => undefined
});

/** No component registered: the selector is stubbed, and what it is handed is what the test reads. */
const components: ComponentContextValue = {
  components: { current: {} },
  componentDefinitions: { current: {} },
  getComponent: () => ({}),
  register: () => ({}),
  unregister: () => [],
  unregisterDefinition: () => undefined,
  registerDefinition: () => undefined
};

const withComponents = (children: ReactNode) => createElement(ComponentContext, { value: components }, children);

const internalProps: InternalPropsSTG0 = { id: 'card-root', rootId: 'card', className: 'plitzi__reference' };
const layout: ElementLayout = { slots: [], rootId: 'card', type: 'component' };

const tree = (plugins: PluginsContextValue, props: InternalPropsSTG0 = internalProps) =>
  withComponents(
    createElement(
      PluginsContext,
      { value: plugins },
      createElement(PluginManager, { type: 'container', internalProps: props, plitziElementLayout: layout })
    )
  );

describe('PluginManager', () => {
  // A component instance's root is drawn through here: a new object each time the plugins arrived had every root of
  // every instance on a page render again with nothing of its own changed (the docs' load, twice per instance).
  it('hands the element the same props when a context it reads changes and its own props do not', () => {
    handed.length = 0;
    const { rerender } = render(tree(pluginsValue()));
    rerender(tree(pluginsValue()));

    expect(handed).toHaveLength(2);
    expect(handed[1]).toBe(handed[0]);
    expect(handed[0]).toEqual({ ...internalProps, plitziElementLayout: layout });
  });

  it('hands new props when its own change', () => {
    handed.length = 0;
    const plugins = pluginsValue();
    const { rerender } = render(tree(plugins));
    rerender(tree(plugins, { ...internalProps, className: 'other' }));

    expect(handed).toHaveLength(2);
    expect(handed[1]).not.toBe(handed[0]);
  });
});
