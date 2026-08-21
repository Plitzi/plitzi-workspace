import { render } from '@testing-library/react';
import { createElement } from 'react';
import { describe, it, expect, vi } from 'vitest';

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
  // `getRemoteSettings` is real: it answers whether a plugin could be loaded in this browser, which is half of
  // the decision under test. Only the selector itself is stubbed, to keep what rendered readable.
  const actual = await importOriginal<typeof import('../helpers/pluginSelector')>();

  return {
    ...actual,
    default: ({ key, type }: { key?: string; type: string }) =>
      createElement('div', { key, 'data-plugin': type, 'data-plugin-key': key })
  };
});

vi.mock('../ServerStaticShell', () => ({
  default: ({ id, children }: { id: string; children?: unknown }) =>
    createElement('div', { 'data-static-shell': id }, children as never)
}));

const el = (id: string, type: string, runtime?: Element['definition']['runtime']): Element => ({
  id,
  attributes: {},
  definition: { rootId: 'root', label: id, type, runtime, styleSelectors: { base: id } }
});

const def = (items?: string[]): Element['definition'] => ({
  rootId: 'root',
  label: 'host',
  type: 'container',
  styleSelectors: { base: 'host' },
  items
});

type Props = Parameters<typeof useInternalItems>[0];

const Harness = (props: Props) => createElement('div', { 'data-testid': 'out' }, useInternalItems(props));

/** `components` is what this browser can render — empty stands for a plugin that exists only on the server. */
const renderItems = (
  props: Props,
  storeValue: Record<string, unknown>,
  rscEnabled = false,
  components: Record<string, unknown> = {}
) =>
  render(
    createElement(
      StoreProvider,
      { value: { ...storeValue, rsc: { enabled: rscEnabled } } },
      createElement(
        ComponentContext,
        { value: { components: { current: components } } as unknown as ComponentContextValue },
        createElement(Harness, props)
      )
    )
  );

/** Stands in for a component the SDK ships: its presence is what lets a server element take over after hydration. */
const clientComponent = { text: () => null };

describe('useInternalItems', () => {
  it('returns nothing when there are no items, children or layout', () => {
    const { container } = renderItems(
      { id: 'host', definition: def(undefined), children: undefined, previewMode: true },
      { schema: { flat: {} } }
    );

    expect(container.querySelector('[data-plugin]')).toBeNull();
  });

  it('renders a plugin per item present in flat and drops the ones that are missing', () => {
    const { container } = renderItems(
      { id: 'host', definition: def(['a', 'missing']), children: undefined, previewMode: true },
      { schema: { flat: { a: el('a', 'text') } } }
    );

    const plugins = container.querySelectorAll('[data-plugin]');

    expect(plugins).toHaveLength(1);
    expect(plugins[0].getAttribute('data-plugin')).toBe('text');
    expect(plugins[0].getAttribute('data-plugin-key')).toBe('a');
  });

  it('renders one plugin per valid item preserving types', () => {
    const { container } = renderItems(
      { id: 'host', definition: def(['a', 'b']), children: undefined, previewMode: true },
      { schema: { flat: { a: el('a', 'text'), b: el('b', 'button') } } }
    );

    const types = [...container.querySelectorAll('[data-plugin]')].map(n => n.getAttribute('data-plugin'));

    expect(types).toEqual(['text', 'button']);
  });

  /** Past hydration — which is what a plain `render` is — the element takes over from the frozen markup, so
   *  everything under a server-driven provider is React's again and can be clicked. */
  it('hands a server-runtime item back to its element once hydration is over', () => {
    const { container } = renderItems(
      { id: 'host', definition: def(['s']), children: undefined, previewMode: true },
      { schema: { flat: { s: el('s', 'text', 'server') } } },
      true,
      clientComponent
    );

    expect(container.querySelector('[data-static-shell]')).toBeNull();
    expect(container.querySelector('[data-plugin="text"]')).not.toBeNull();
  });

  /** The one that stays frozen: there is nothing to take over with, so the server's markup is all there is. */
  it('keeps a server-runtime item frozen when this browser has no component for it', () => {
    const { container } = renderItems(
      { id: 'host', definition: def(['s']), children: undefined, previewMode: true },
      { schema: { flat: { s: el('s', 'text', 'server') } } },
      true
    );

    expect(container.querySelector('[data-static-shell="s"]')).not.toBeNull();
  });

  /** Frozen or not, the element travels INTO the shell — a route change mounts a page whose server markup this
   *  document never carried, and an element with nothing to freeze against renders itself instead of nothing. */
  it('hands the element to the shell as its fallback', () => {
    const { container } = renderItems(
      { id: 'host', definition: def(['s']), children: undefined, previewMode: true },
      { schema: { flat: { s: el('s', 'text', 'server') } } },
      true
    );

    expect(container.querySelector('[data-static-shell="s"] [data-plugin="text"]')).not.toBeNull();
  });

  it('mounts a server-runtime item as a plugin when RSC is not live for this render', () => {
    const { container } = renderItems(
      { id: 'host', definition: def(['s']), children: undefined, previewMode: true },
      { schema: { flat: { s: el('s', 'text', 'server') } } }
    );

    expect(container.querySelector('[data-static-shell]')).toBeNull();
    expect(container.querySelector('[data-plugin="text"]')).not.toBeNull();
  });

  it('keeps a client-runtime item mounted (not frozen) in preview on the client', () => {
    const { container } = renderItems(
      { id: 'host', definition: def(['c']), children: undefined, previewMode: true },
      { schema: { flat: { c: el('c', 'text', 'client') } } },
      true
    );

    expect(container.querySelector('[data-static-shell]')).toBeNull();
    expect(container.querySelector('[data-plugin="text"]')).not.toBeNull();
  });

  it('pushes the layout body when the host is the layout container', () => {
    const { container } = renderItems(
      {
        id: 'X',
        definition: def(['a']),
        plitziElementLayout: {
          containerId: 'X',
          rootId: 'root',
          referenceId: 'r',
          type: 'layout',
          bodyChildren: createElement('span', { 'data-body': true })
        },
        children: undefined,
        previewMode: false
      },
      { schema: { flat: { a: el('a', 'text') } } }
    );

    expect(container.querySelector('[data-plugin="text"]')).not.toBeNull();
    expect(container.querySelector('[data-body]')).not.toBeNull();
  });

  it('appends a valid children element alongside the items', () => {
    const { container } = renderItems(
      {
        id: 'host',
        definition: def(['a']),
        children: createElement('span', { 'data-child': true }),
        previewMode: true
      },
      { schema: { flat: { a: el('a', 'text') } } }
    );

    expect(container.querySelector('[data-plugin="text"]')).not.toBeNull();
    expect(container.querySelector('[data-child]')).not.toBeNull();
  });

  it('appends each valid element of a children array and skips invalid entries', () => {
    const { container } = renderItems(
      {
        id: 'host',
        definition: def(['a']),
        children: [
          createElement('span', { key: 'c1', 'data-child': '1' }),
          null,
          createElement('span', { key: 'c2', 'data-child': '2' })
        ],
        previewMode: true
      },
      { schema: { flat: { a: el('a', 'text') } } }
    );

    expect(container.querySelector('[data-plugin="text"]')).not.toBeNull();
    expect([...container.querySelectorAll('[data-child]')].map(n => n.getAttribute('data-child'))).toEqual(['1', '2']);
  });
});
