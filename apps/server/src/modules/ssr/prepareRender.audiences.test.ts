import { describe, expect, it, vi } from 'vitest';

import { prepareRender } from './prepareRender';

import type { PluginManager } from '../../plugins/manager';
import type { SSRPageServerConfig } from '../../types';
import type { SSRRequest } from '@plitzi/sdk-kernel/types';
import type { Element, OfflineDataRaw } from '@plitzi/sdk-shared';

const element = (
  id: string,
  type: string,
  items: string[] = [],
  attributes: Record<string, unknown> = {}
): Element => ({
  id,
  attributes,
  definition: { type, label: id, rootId: 'home', items, styleSelectors: { base: '' } }
});

const byDevice = { combinator: 'and', rules: [{ field: 'visitor.device', operator: '=', value: 'mobile' }] };

/** A home page holding an audience: one variant for phones, one for everybody else. */
const space = (): OfflineDataRaw =>
  ({
    schema: {
      flat: {
        home: element('home', 'page', ['welcome'], { slug: '', folder: '', default: true }),
        welcome: element('welcome', 'audience', ['phones', 'rest']),
        phones: element('phones', 'audienceVariant', [], { when: byDevice }),
        rest: element('rest', 'audienceVariant')
      },
      pages: ['home'],
      pageFolders: [],
      components: {},
      definition: { name: 'test', permanentUrl: 'test' },
      variables: [],
      settings: { customCss: '' }
    },
    plugins: [],
    style: { cache: '', variables: [], fonts: [] }
  }) as unknown as OfflineDataRaw; // A fixture of the fields a render reads, not a whole stored space.

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';

const prepared = (audienceKey?: string) =>
  prepareRender(
    {
      method: 'GET',
      path: '/',
      search: '',
      url: '/',
      protocol: 'https',
      hostname: 'x.test',
      headers: { host: 'x.test', 'user-agent': IPHONE, 'accept-language': 'es' },
      query: {},
      ctx: {
        spaceDeployment: { spaceId: 42, environment: 'production', revision: 1 },
        ...(audienceKey === undefined ? {} : { audienceKey })
      }
    } as unknown as SSRRequest, // The fields a render reads of a request.
    {
      environment: 'production',
      assetVersion: '1',
      autoLoadSchemaPlugins: false,
      adapters: {
        getOfflineData: vi.fn().mockResolvedValue(space()),
        getSpaceDeployment: () => Promise.resolve(undefined)
      }
    } as unknown as SSRPageServerConfig, // Only the adapters a render asks.
    42,
    'production',
    1,
    {
      getEntries: () => Promise.resolve([]),
      getComponents: () => ({}),
      ensure: () => ''
    } as unknown as PluginManager // No plugins in this space.
  );

describe('prepareRender / audiences', () => {
  it('hands the browser the visitor the page was drawn for', async () => {
    const prep = await prepared('device=mobile');

    expect(prep.componentProps.serverVisitor).toEqual({ returning: false, language: 'es', device: 'mobile' });
    expect(prep.templateParams.offlineData).toContain('"serverVisitor":');
    expect(prep.cacheable).toBe(true);
  });

  it('keeps for nobody a page its audiences drew when it was not keyed by what they read', async () => {
    expect((await prepared()).cacheable).toBe(false);
  });
});
