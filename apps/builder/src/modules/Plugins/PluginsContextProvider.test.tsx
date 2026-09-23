import { act, render } from '@testing-library/react';
import { use } from 'react';
import { describe, expect, it, vi } from 'vitest';

import ComponentProvider from '@plitzi/sdk-elements/Component/ComponentProvider';
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import Elements from '@pmodules/Elements/Elements';

import PluginsContextProvider from './PluginsContextProvider';

import type { ComponentContextValue, ComponentDefinition, PluginsContextValue } from '@plitzi/sdk-shared';
import type { NetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';

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
  const contexts: { plugins?: PluginsContextValue; components?: ComponentContextValue } = {};
  const Probe = () => {
    contexts.plugins = use(PluginsContext);
    contexts.components = use(ComponentContext);

    return null;
  };

  const tree = () => (
    <NetworkContext value={{ mutate } as unknown as NetworkContextValue}>
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

  return { ...view, contexts, mutate };
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
