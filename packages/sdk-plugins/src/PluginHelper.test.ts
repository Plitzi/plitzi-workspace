import { beforeEach, describe, expect, it, vi } from 'vitest';

import { manifestOf, rawOf } from './tests/manifest';

import type { PluginManifest } from '@plitzi/sdk-shared';

const { fetchManifest } = vi.hoisted(() => ({ fetchManifest: vi.fn<(url: string) => Promise<unknown>>() }));

vi.mock('@plitzi/sdk-shared/helpers', async importOriginal => ({
  ...(await importOriginal<object>()),
  fetchManifest
}));

const { fetchPluginsManifests, getLocalCustomStyle, getStyle, pluginParseDefinition } = await import('./PluginHelper');

/** A CDN that answers each plugin's manifest by its URL. */
const serving = (manifests: Record<string, PluginManifest | Error>) => {
  fetchManifest.mockImplementation(url => {
    const answer = manifests[url];

    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  });
};

beforeEach(() => {
  fetchManifest.mockReset();
});

describe('fetchPluginsManifests', () => {
  it('answers each manifest by its root, and leaves out one that could not be fetched', async () => {
    serving({ a: manifestOf('charts', 'charts'), b: new Error('404'), c: manifestOf('maps', 'maps') });

    expect(Object.keys(await fetchPluginsManifests(['a', 'b', 'c']))).toEqual(['charts', 'maps']);
  });

  it('asks nothing for no manifests', async () => {
    expect(await fetchPluginsManifests([])).toEqual({});
    expect(fetchManifest).not.toHaveBeenCalled();
  });
});

describe('pluginParseDefinition', () => {
  it("reads each plugin's components from its manifest, the main one carrying the others as its sub-plugins", async () => {
    serving({ 'https://cdn.example.com/charts/plugin-manifest.json': manifestOf('charts', 'charts') });
    const definitions = await pluginParseDefinition([rawOf('charts')]);

    expect(Object.keys(definitions)).toEqual(['charts', 'chartsLegend']);
    expect(definitions.charts).toMatchObject({
      isMain: true,
      type: 'charts',
      resource: 'https://cdn.example.com/charts',
      settings: { theme: 'dark' },
      subPlugins: ['chartsLegend'],
      market: { owner: 'Ana', verified: true, license: 'MIT', category: 'Charts', backgroundColor: '#123456' }
    });
    expect(definitions.chartsLegend).toMatchObject({ isMain: false, subPlugins: [] });
  });

  it('loads only what a page can load — scripts and stylesheets with a source — and no settings asset as main', async () => {
    serving({ 'https://cdn.example.com/charts/plugin-manifest.json': manifestOf('charts', 'charts') });
    const { charts } = await pluginParseDefinition([rawOf('charts')]);

    expect(charts.assets.map(asset => asset.type)).toEqual(['script', 'link']);
    expect(charts.assetsSettings).toHaveLength(1);
    expect(charts.assetsSettings[0]).not.toHaveProperty('isMain');
  });

  it('fetches nothing for a plugin with no resource, and reads nothing it could not fetch', async () => {
    serving({});
    const definitions = await pluginParseDefinition([rawOf('charts', '')]);

    expect(fetchManifest).not.toHaveBeenCalled();
    expect(definitions).toEqual({});
  });

  it('answers nothing for what is not a list of plugins', async () => {
    expect(await pluginParseDefinition(rawOf('charts'))).toEqual({});
  });
});

describe('getStyle', () => {
  it("collects every plugin's stylesheets, keyed so one shared by two plugins is linked once", async () => {
    serving({
      'https://cdn.example.com/charts/plugin-manifest.json': manifestOf('charts', 'charts'),
      'https://cdn.example.com/maps/plugin-manifest.json': manifestOf('maps', 'maps')
    });
    const style = getStyle(await pluginParseDefinition([rawOf('charts'), rawOf('maps')]));

    expect(Object.values(style).map(asset => asset.type)).toEqual(['link', 'link']);
    expect(Object.values(style).map(asset => (asset.type === 'link' ? asset.params.href : ''))).toEqual([
      'https://cdn.example.com/charts/style.css',
      'https://cdn.example.com/maps/style.css'
    ]);
  });
});

describe('getLocalCustomStyle', () => {
  // A registered component is a function with its fields on it: what a path reader (`get`) does not walk.
  const component = (origin: 'local' | 'local-custom', id: string) =>
    Object.assign(() => null, {
      origin,
      assets: [
        { type: 'link' as const, id, params: { href: `/${id}`, type: 'text/css' as const, rel: 'stylesheet' as const } }
      ]
    });

  it('is the stylesheets of the plugins a host hands over in its own code, and of no other', () => {
    const styles = getLocalCustomStyle({
      seatPicker: component('local-custom', 'seat-picker.css'),
      button: component('local', 'button.css')
    });

    expect(Object.keys(styles)).toEqual([btoa('seat-picker.css')]);
    expect(styles[btoa('seat-picker.css')]).toMatchObject({ params: { href: '/seat-picker.css' } });
  });
});
