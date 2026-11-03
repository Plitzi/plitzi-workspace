import { act, render } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';
import { ComponentContext } from '@plitzi/sdk-shared/elements';
import { createElementRegistry, ElementRegistryContext } from '@plitzi/sdk-shared/plugins/react';

import useInternalItems from './useInternalItems';

import type { ComponentContextValue, ComponentDefinition, ComponentPluginWithHOC, Element } from '@plitzi/sdk-shared';

vi.mock('../helpers/pluginSelector', async importOriginal => ({
  ...(await importOriginal<typeof import('../helpers/pluginSelector')>()),
  default: ({ key, type }: { key?: string; type: string }) => createElement('section', { key, 'data-plugin': type })
}));

const element = (id: string, type: string): Element => ({
  id,
  attributes: {},
  definition: { rootId: 'root', label: id, type, styleSelectors: { base: '' } }
});

/**
 * A registered component, as the registry holds one, for a test that asks only whether its type is registered — never
 * draws it (`pluginSelector` is mocked): its content, assets and origin are not read, so none is written.
 */
const card = (() => null) as unknown as ComponentPluginWithHOC;
const components: ComponentContextValue['components'] = { current: { card } };
const componentDefinitions: ComponentContextValue['componentDefinitions'] = { current: {} };

/**
 * A plugin as the registry holds it, for the one type a test needs. A definition carries a manifest, its settings, its
 * builder's part — none of which telling whether a type is registered reads — so only the type is written.
 */
const plugin = (type: string): ComponentDefinition => ({ type }) as unknown as ComponentDefinition;

/**
 * A plugin the page loads after it hydrated joins the registries, which are new objects then: every container of the
 * page drew again for it. On a published page a container follows only whether its OWN items' types are registered.
 */
describe('a container and the registries it draws from', () => {
  const setup = () => {
    let draws = 0;
    const Host = () => {
      draws++;

      return createElement(
        'div',
        null,
        useInternalItems({
          id: 'host',
          definition: {
            rootId: 'root',
            label: 'host',
            type: 'container',
            styleSelectors: { base: '' },
            items: ['a', 'b']
          },
          children: undefined,
          previewMode: true
        })
      );
    };
    const registry = createElementRegistry({ components, componentDefinitions, plugins: {} });
    render(
      createElement(
        StoreProvider,
        { value: { schema: { flat: { a: element('a', 'card'), b: element('b', 'chart') } } } },
        createElement(ElementRegistryContext, { value: registry }, createElement(Host))
      )
    );

    return { registry, draws: () => draws };
  };

  it('is not drawn again for a plugin none of its items is', () => {
    const { registry, draws } = setup();
    const before = draws();

    act(() => {
      registry.set({ components, componentDefinitions, plugins: { other: plugin('other') } });
    });

    expect(draws()).toBe(before);
  });

  it('is drawn again when the plugin one of its items is arrives', () => {
    const { registry, draws } = setup();
    const before = draws();

    act(() => {
      registry.set({ components, componentDefinitions, plugins: { chart: plugin('chart') } });
    });

    expect(draws()).toBe(before + 1);
  });

  // The builder changes a plugin's settings under the same type: there the container follows the context itself.
  it('follows the contexts in the builder, where there is no registry to follow', () => {
    const Host = () =>
      createElement(
        'div',
        null,
        useInternalItems({
          id: 'host',
          definition: { rootId: 'root', label: 'host', type: 'container', styleSelectors: { base: '' }, items: ['a'] },
          children: undefined,
          previewMode: false
        })
      );
    const view = render(
      createElement(
        StoreProvider,
        { value: { schema: { flat: { a: element('a', 'card') } } } },
        createElement(
          ComponentContext,
          // The registry's two boxes alone: what drawing items reads of the context.
          { value: { components, componentDefinitions } as unknown as ComponentContextValue },
          createElement(Host)
        )
      )
    );

    expect(view.container.querySelector('[data-plugin="card"]')).not.toBeNull();
  });
});
