import { render } from '@testing-library/react';
import { createElement } from 'react';
import { describe, it, expect, vi } from 'vitest';

import StoreProvider from '@plitzi/nexus/StoreProvider';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import useInternalItems from './useInternalItems';

import type { ComponentContextValue, Element } from '@plitzi/sdk-shared';

vi.mock('@plitzi/sdk-shared', async importOriginal => {
  const actual = await importOriginal<typeof import('@plitzi/sdk-shared')>();
  const React = await import('react');
  const PluginsContext = React.createContext({ plugins: {} });

  return { ...actual, usePlitziServiceContext: () => ({ contexts: { PluginsContext } }) };
});

vi.mock('../helpers/pluginSelector', () => ({
  default: ({ key, type }: { key?: string; type: string }) =>
    createElement('div', { key, 'data-plugin': type, 'data-plugin-key': key })
}));

vi.mock('../ServerStaticShell', () => ({
  default: ({ id }: { id: string }) => createElement('div', { 'data-static-shell': id })
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

const renderItems = (props: Props, storeValue: Record<string, unknown>) =>
  render(
    createElement(
      StoreProvider,
      { value: storeValue },
      createElement(
        ComponentContext,
        { value: { components: { current: {} } } as unknown as ComponentContextValue },
        createElement(Harness, props)
      )
    )
  );

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

  it('freezes a server-runtime item as a static shell in preview on the client', () => {
    const { container } = renderItems(
      { id: 'host', definition: def(['s']), children: undefined, previewMode: true },
      { schema: { flat: { s: el('s', 'text', 'server') }, rsc: { enabled: true } } }
    );

    expect(container.querySelector('[data-static-shell="s"]')).not.toBeNull();
    expect(container.querySelector('[data-plugin]')).toBeNull();
  });

  it('keeps a client-runtime item mounted (not frozen) in preview on the client', () => {
    const { container } = renderItems(
      { id: 'host', definition: def(['c']), children: undefined, previewMode: true },
      { schema: { flat: { c: el('c', 'text', 'client') }, rsc: { enabled: true } } }
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
});
