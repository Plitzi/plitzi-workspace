import { describe, it, expect, vi } from 'vitest';

import { prepareRender } from './prepareRender';

import type { PluginManager } from '../../plugins/manager';
import type { Element, OfflineDataRaw, SSRPageServerConfig, SSRRequest } from '@plitzi/sdk-shared';

const element = (id: string, items: string[] = [], runtime?: 'server' | 'client'): Element => ({
  id,
  attributes: {},
  definition: { type: id, label: id, rootId: 'home', items, styleSelectors: { base: '' }, runtime }
});

const page = (id: string, slug: string, items: string[]): Element => ({
  id,
  attributes: { slug, folder: '', default: false },
  definition: { type: 'page', label: id, rootId: 'root', items, styleSelectors: { base: '' } }
});

const offlineData = (runtime?: 'server' | 'client'): OfflineDataRaw =>
  ({
    schema: {
      flat: { home: page('home', '', ['child']), child: element('child', [], runtime) },
      pages: ['home'],
      pageFolders: [],
      definition: { name: 'test', permanentUrl: 'test' },
      variables: [],
      settings: { customCss: '' },
      rsc: { enabled: true }
    },
    plugins: [],
    style: { cache: '', variables: [] }
  }) as unknown as OfflineDataRaw;

const request = (): SSRRequest =>
  ({
    method: 'GET',
    path: '/',
    search: '',
    url: '/',
    protocol: 'https',
    hostname: 'x.test',
    headers: {},
    query: {},
    ctx: { spaceDeployment: { spaceId: 42, environment: 'production', revision: 0 } }
  }) as unknown as SSRRequest;

const pluginManager = () =>
  ({ getEntries: () => Promise.resolve([]), getComponents: () => ({}), ensure: () => '' }) as unknown as PluginManager;

const render = (runtime?: 'server' | 'client') => {
  const getRscData = vi.fn().mockResolvedValue({ serverData: { child: { ok: true } } });
  const config = {
    environment: 'production',
    assetVersion: '1',
    autoLoadSchemaPlugins: false,
    adapters: {
      getOfflineData: () => Promise.resolve(offlineData(runtime)),
      getSpaceDeployment: () => Promise.resolve(undefined),
      getRscData
    }
  } as unknown as SSRPageServerConfig;

  return {
    getRscData,
    prep: prepareRender(request(), config, 42, 'production', 0, pluginManager())
  };
};

describe('prepareRender / the RSC gate', () => {
  it('asks the adapter for a page that has a server element', async () => {
    const { getRscData, prep } = render('server');
    const { componentProps } = await prep;

    expect(getRscData).toHaveBeenCalledTimes(1);
    expect(componentProps.server.ssr?.rscData).toEqual({ serverData: { child: { ok: true } } });
  });

  it('never reaches the adapter for a page that has none — that is the API call this saves', async () => {
    const { getRscData, prep } = render('client');
    const { componentProps } = await prep;

    expect(getRscData).not.toHaveBeenCalled();
    // Still a payload, and an empty one: a client told nothing arrived would go and fetch it.
    expect(componentProps.server.ssr?.rscData).toEqual({ serverData: {} });
    expect(componentProps.server.ssr?.rscPath).toBe('/_rsc');
  });
});
