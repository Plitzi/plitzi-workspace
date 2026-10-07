import { act, createElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import useInternalItems from './useInternalItems';

import type { ComponentContextValue, Element } from '@plitzi/sdk-shared';

vi.mock('@plitzi/sdk-shared', async importOriginal => {
  const actual = await importOriginal<typeof import('@plitzi/sdk-shared')>();
  const React = await import('react');
  const PluginsContext = React.createContext({ plugins: {} });

  return { ...actual, usePlitziServiceContext: () => ({ contexts: { PluginsContext } }) };
});

vi.mock('../helpers/pluginSelector', async importOriginal => {
  const actual = await importOriginal<typeof import('../helpers/pluginSelector')>();

  return {
    ...actual,
    default: ({ key, type }: { key?: string; type: string }) => createElement('section', { key, 'data-plugin': type })
  };
});

const feed: Element = {
  id: 'feed',
  attributes: {},
  definition: { rootId: 'root', label: 'feed', type: 'apiContainer', runtime: 'server', styleSelectors: { base: '' } }
};

const Harness = () =>
  createElement(
    'div',
    null,
    useInternalItems({
      id: 'host',
      definition: { rootId: 'root', label: 'host', type: 'container', styleSelectors: { base: '' }, items: ['feed'] },
      children: undefined,
      previewMode: true
    })
  );

const tree = () =>
  createElement(
    StoreProvider,
    { value: { schema: { flat: { feed } }, rsc: { enabled: true } } },
    createElement(
      ComponentContext,
      {
        value: {
          components: { current: { apiContainer: () => null } },
          componentDefinitions: { current: {} }
        } as unknown as ComponentContextValue
      },
      createElement(Harness)
    )
  );

// A server element with no markup of its own — a provider around the whole layout — hydrates as itself. The render
// right after hydration used to unwrap it under another key, and React rebuilt everything under it: the layout's DOM
// replaced, every animation in it started again.
describe('a server-runtime element across hydration', () => {
  it('keeps the markup the server sent: nothing under it is mounted twice', async () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(tree());
    document.body.append(container);
    const served = container.querySelector('[data-plugin="apiContainer"]');

    await act(async () => {
      hydrateRoot(container, tree());
      await Promise.resolve();
    });

    expect(served).not.toBeNull();
    expect(container.querySelector('[data-plugin="apiContainer"]')).toBe(served);
    container.remove();
  });
});
