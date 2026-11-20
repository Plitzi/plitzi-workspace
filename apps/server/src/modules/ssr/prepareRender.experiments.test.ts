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

/** A home page holding one A/B test: half the visitors see B. */
const space = (): OfflineDataRaw =>
  ({
    schema: {
      flat: {
        home: element('home', 'page', ['hero'], { slug: '', folder: '', default: true }),
        hero: element('hero', 'abTest', ['heroA', 'heroB'], { experiment: 'heroTest' }),
        heroA: element('heroA', 'abTestVariant', [], { weight: 50 }),
        heroB: element('heroB', 'abTestVariant', [], { weight: 50 })
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

const prepared = (cookie?: string, query: Record<string, string> = {}, config: Record<string, unknown> = {}) =>
  prepareRender(
    {
      method: 'GET',
      path: '/',
      search: '',
      url: '/',
      protocol: 'https',
      hostname: 'x.test',
      headers: { host: 'x.test', ...(cookie ? { cookie } : {}) },
      query,
      ctx: { spaceDeployment: { spaceId: 42, environment: 'production', revision: 1 } }
    } as unknown as SSRRequest, // The fields a render reads of a request.
    {
      environment: 'production',
      assetVersion: '1',
      autoLoadSchemaPlugins: false,
      ...config,
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

describe('prepareRender / A/B tests', () => {
  it('draws a first visitor their variant, keeps it in their cookie, and keeps the page for nobody else', async () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.8);
    const prep = await prepared();

    expect(prep.componentProps.serverExperiments).toEqual({ heroTest: 'b' });
    expect(prep.templateParams.offlineData).toContain('"serverExperiments":{"heroTest":"b"}');
    expect(prep.setCookie).toBe('plitzi_ab=heroTest%3Ab; Path=/; Max-Age=15552000; SameSite=Lax; Secure');
    expect(prep.cacheable).toBe(false);
  });

  it('draws a returning visitor the variant they kept, and their page may be kept for whoever kept the same', async () => {
    const prep = await prepared('plitzi_ab=heroTest%3Aa');

    expect(prep.componentProps.serverExperiments).toEqual({ heroTest: 'a' });
    expect(prep.setCookie).toBeUndefined();
    expect(prep.cacheable).toBe(true);
  });

  it('draws a picture of the page with the control, and keeps nothing', async () => {
    const prep = await prepared(undefined, { __pt: 'token' });

    expect(prep.componentProps.serverExperiments).toEqual({ heroTest: 'a' });
    expect(prep.setCookie).toBeUndefined();
  });

  it('shows a tester what they forced on a page allowed to debug, and keeps that page for nobody', async () => {
    const prep = await prepared('plitzi_ab=heroTest%3Aa; plitzi_ab_qa=heroTest%3Ab', {}, { debugMode: true });

    expect(prep.componentProps.serverExperiments).toEqual({ heroTest: 'a' });
    expect(prep.componentProps.forcedExperiments).toEqual({ heroTest: 'b' });
    expect(prep.cacheable).toBe(false);
  });

  it('ignores a forcing cookie on a page that does not authorize debugging', async () => {
    const prep = await prepared('plitzi_ab=heroTest%3Aa; plitzi_ab_qa=heroTest%3Ab', { ab: 'heroTest:b' });

    expect(prep.componentProps.forcedExperiments).toBeUndefined();
    expect(prep.cacheable).toBe(true);
  });
});
