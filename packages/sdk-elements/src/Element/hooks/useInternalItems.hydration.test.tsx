import { act, createElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';
import { ComponentContext } from '@plitzi/sdk-shared/elements';

import useInternalItems, { useItemsSources } from './useInternalItems';

import type { ComponentContextValue, Element } from '@plitzi/sdk-shared';

vi.mock('@plitzi/sdk-shared/plugins/react', async importOriginal => {
  const { createContext } = await import('react');

  return {
    ...(await importOriginal<typeof import('@plitzi/sdk-shared/plugins/react')>()),
    PluginsContext: createContext({ plugins: {} })
  };
});

/** Whether the element draws markup of its own, marked as the server marks it. */
const marked = vi.hoisted(() => ({ current: false }));

vi.mock('../helpers/pluginSelector', async importOriginal => {
  const actual = await importOriginal<typeof import('../helpers/pluginSelector')>();

  return {
    ...actual,
    // As `RootElement` draws a server element: its root marked with `data-rsc-id`, its own markup under it.
    default: ({ key, type }: { key?: string; type: string }) =>
      createElement(
        'section',
        { key, 'data-plugin': type, ...(marked.current ? { 'data-rsc-id': key } : {}) },
        marked.current ? createElement('p', { className: 'card' }, 'drawn by the server') : undefined
      )
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
      ...useItemsSources(),
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

  // A provider with markup of its own was frozen for hydration — a copy of the server's HTML — and swapped for itself
  // on the render right after: the same nodes to the eye, but new ones. Every animation under it started twice on
  // every load (17 of a home's 23), and so did the fade of every card of a list it fed.
  it('hydrates an element it can draw over the server’s markup, instead of freezing it and building it again', async () => {
    marked.current = true;
    const container = document.createElement('div');
    container.innerHTML = renderToString(tree());
    document.body.append(container);
    const served = container.querySelector('.card');

    await act(async () => {
      hydrateRoot(container, tree());
      await Promise.resolve();
    });
    // The render right after hydration, when a frozen element used to be swapped.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    expect(served).not.toBeNull();
    expect(container.querySelector('.card')).toBe(served);
    expect(container.querySelector('[data-plugin="apiContainer"]')?.hasAttribute('data-rsc-id')).toBe(true);
    container.remove();
    marked.current = false;
  });
});
