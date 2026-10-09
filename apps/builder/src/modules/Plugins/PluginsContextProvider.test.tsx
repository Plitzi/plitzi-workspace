import { act, fireEvent, render } from '@testing-library/react';
import { use } from 'react';
import { describe, expect, it, vi } from 'vitest';

import ComponentProvider from '@plitzi/sdk-elements/Component/ComponentProvider';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import PluginsContext from '@plitzi/sdk-shared/plugins/PluginsContext';
import Elements from '@pmodules/Elements/Elements';

import PluginsContextProvider from './PluginsContextProvider';

import type { ComponentContextValue, ComponentDefinition, PluginsContextValue } from '@plitzi/sdk-shared';
import type { NetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';

// The catalog under test is the elements': the space's components — their chip and their list — read a store these
// tests do not mount, and a space with none is all they need of it.
vi.mock('@pmodules/Components', () => ({ default: () => null }));
vi.mock('@plitzi/sdk-shared/store', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/store')>()),
  useBuilderStore: () => [{}]
}));

// Only what the catalog and the stylesheet map read of an installed plugin; the full type describes far more.
const plugin = (type: string, label: string) =>
  ({
    type,
    definition: { type, label },
    market: { category: 'Plugins' },
    assets: [{ type: 'link', id: `${type}.css`, params: { href: `/${type}.css` } }]
  }) as unknown as ComponentDefinition;

const installed = { weather: plugin('weather', 'Weather card'), clock: plugin('clock', 'World clock') };

/** The builder as far as installing plugins goes: the context, the component registry and the open catalog. */
const renderBuilder = () => {
  // The network only has to say the removal went through; the stubbed value is the one method the provider calls.
  const mutate = vi.fn(() => Promise.resolve({ success: true, result: { plugins: [] } }));
  // The space's one channel, as a builder holds it: handlers by event, and a way to deliver one as another builder.
  const handlers = new Map<string, (payload: unknown) => void>();
  const subscriptionManager = {
    subscribe: (event: string, callback: (payload: unknown) => void) => {
      handlers.set(event, callback);

      return () => handlers.delete(event);
    },
    unsubscribe: vi.fn(),
    stop: vi.fn()
  };
  const deliver = (event: string, payload: unknown) => handlers.get(event)?.(payload);
  const contexts: { plugins?: PluginsContextValue; components?: ComponentContextValue } = {};
  const Probe = () => {
    contexts.plugins = use(PluginsContext);
    contexts.components = use(ComponentContext);

    return null;
  };

  const tree = () => (
    <NetworkContext value={{ mutate, subscriptionManager } as unknown as NetworkContextValue}>
      <ComponentProvider>
        <PluginsContextProvider plugins={installed}>
          <Probe />
          <Elements />
        </PluginsContextProvider>
      </ComponentProvider>
    </NetworkContext>
  );

  const view = render(tree());
  // Registered the way `add` registers one, into the registry the catalog reads.
  contexts.components?.registerDefinition(installed);
  view.rerender(tree());
  // The catalog shows one category at a time, and the built-in elements' comes first: the plugins' is opened.
  fireEvent.click(view.getByRole('tab', { name: /Plugins/ }));

  return { ...view, contexts, mutate, deliver };
};

describe('PluginsContextProvider — removing a plugin', () => {
  it('takes its elements out of the open catalog and keeps the other plugins’ stylesheets', async () => {
    const { contexts, getByTitle, queryByTitle, mutate } = renderBuilder();

    expect(getByTitle('Weather card')).toBeTruthy();
    expect(contexts.plugins?.assets).toHaveProperty(btoa('weather.css'));
    expect(contexts.plugins?.assets).toHaveProperty(btoa('clock.css'));

    await act(async () => {
      await contexts.plugins?.remove?.('weather');
    });

    expect(mutate).toHaveBeenCalledWith('SpaceRemovePlugin', { pluginType: 'weather' });
    expect(contexts.plugins?.plugins).not.toHaveProperty('weather');
    expect(contexts.components?.componentDefinitions.current).not.toHaveProperty('weather');
    expect(queryByTitle('Weather card')).toBeNull();
    expect(getByTitle('World clock')).toBeTruthy();
    expect(contexts.plugins?.assets).not.toHaveProperty(btoa('weather.css'));
    // Every plugin stylesheet used to go with the first plugin removed.
    expect(contexts.plugins?.assets).toHaveProperty(btoa('clock.css'));
  });
});

/**
 * A change another builder made — a collaborator, or `plitzi plugin upload` with no builder open — arriving on the
 * space's channel, applied here without a reload and without a mutation of this builder's own.
 */
describe('PluginsContextProvider — changes from elsewhere', () => {
  it('takes a plugin somebody else removed out of the catalog', async () => {
    const { contexts, queryByTitle, getByTitle, mutate, deliver } = renderBuilder();

    await act(async () => {
      deliver('SPACE_REMOVE_PLUGIN', { pluginType: 'weather' });
      await Promise.resolve();
    });

    expect(mutate).not.toHaveBeenCalled();
    expect(contexts.plugins?.plugins).not.toHaveProperty('weather');
    expect(queryByTitle('Weather card')).toBeNull();
    expect(getByTitle('World clock')).toBeTruthy();
  });

  it('stops listening when it unmounts', () => {
    const { unmount, deliver, contexts } = renderBuilder();
    const before = contexts.plugins?.plugins;

    unmount();
    deliver('SPACE_REMOVE_PLUGIN', { pluginType: 'weather' });

    expect(contexts.plugins?.plugins).toBe(before);
  });
});
