import { describe, it, expect, vi } from 'vitest';

import { prepareRender } from './prepareRender';
import { RequestMetrics } from '../../helpers/metrics';

import type { PluginManager } from '../../plugins/manager';
import type { Element, OfflineDataRaw, SchemaRsc, SSRPageServerConfig, SSRRequest } from '@plitzi/sdk-shared';

const element = (id: string, items: string[] = [], runtime?: 'server' | 'client'): Element => ({
  id,
  attributes: {},
  definition: { type: id, label: id, rootId: 'root', items, styleSelectors: { base: '' }, runtime }
});

const page = (id: string, slug: string, items: string[], seo: Record<string, unknown> = {}): Element => ({
  id,
  attributes: { slug, folder: '', default: false, ...seo },
  definition: { type: 'page', label: id, rootId: 'root', items, styleSelectors: { base: '' } }
});

/**
 * The arrangement this gate exists for: a space where one page is backed by a provider and the next one is not.
 * `/blog/{{slug}}` resolves server-side; `/` and `/about` are ordinary pages that happen to live in the same space,
 * and rendering either of them must not reach the provider that only `/blog` has.
 */
const offlineData = (
  rsc: SchemaRsc | undefined = { enabled: true },
  homeRuntime: 'server' | 'client' = 'client'
): OfflineDataRaw =>
  ({
    schema: {
      flat: {
        home: page('home', '', ['homeText'], {
          seoEnabled: true,
          seoPageTitle: 'Home — test space',
          seoPageDescription: 'What the home page says about itself.'
        }),
        homeText: element('homeText', [], homeRuntime),
        blog: page('blog', 'blog/{{slug}}', ['blogApi']),
        blogApi: element('blogApi', [], 'server'),
        about: page('about', 'about', ['aboutBox']),
        aboutBox: element('aboutBox', ['aboutInner']),
        aboutInner: element('aboutInner', ['aboutApi']),
        aboutApi: element('aboutApi', [], 'server')
      },
      pages: ['home', 'blog', 'about'],
      pageFolders: [],
      definition: { name: 'test', permanentUrl: 'test' },
      variables: [],
      settings: { customCss: '' },
      rsc
    },
    plugins: [],
    style: { cache: '', variables: [] }
  }) as unknown as OfflineDataRaw;

const request = (path: string, query: Record<string, string> = {}): SSRRequest =>
  ({
    method: 'GET',
    path,
    search: '',
    url: path,
    protocol: 'https',
    hostname: 'x.test',
    headers: {},
    query,
    ctx: { spaceDeployment: { spaceId: 42, environment: 'production', revision: 0 } }
  }) as unknown as SSRRequest;

const pluginManager = () =>
  ({ getEntries: () => Promise.resolve([]), getComponents: () => ({}), ensure: () => '' }) as unknown as PluginManager;

type Options = {
  rsc?: SchemaRsc;
  /** What the deployment configured, as opposed to what the schema asks for. */
  configRsc?: { enabled?: boolean };
  withAdapter?: boolean;
  homeRuntime?: 'server' | 'client';
  /** What the deployment authorizes for debugging, and what the URL asks for. */
  debugMode?: boolean;
  query?: Record<string, string>;
};

const render = async (
  path: string,
  { rsc = { enabled: true }, configRsc, withAdapter = true, homeRuntime, debugMode, query }: Options = {}
) => {
  const getRscData = vi.fn().mockResolvedValue({ serverData: { resolved: true } });
  const getOfflineData = vi.fn().mockResolvedValue(offlineData(rsc, homeRuntime));
  const metrics = new RequestMetrics();
  const config = {
    environment: 'production',
    assetVersion: '1',
    autoLoadSchemaPlugins: false,
    rsc: configRsc,
    debugMode,
    adapters: {
      getOfflineData,
      getSpaceDeployment: () => Promise.resolve(undefined),
      ...(withAdapter ? { getRscData } : {})
    }
  } as unknown as SSRPageServerConfig;

  const { componentProps, templateParams } = await prepareRender(
    request(path, query),
    config,
    42,
    'production',
    0,
    pluginManager(),
    undefined,
    metrics
  );

  return {
    getRscData,
    getOfflineData,
    templateParams,
    componentProps,
    ssr: componentProps.server.ssr,
    timing: metrics.toServerTimingHeader()
  };
};

describe('prepareRender / the RSC gate', () => {
  it('asks the adapter for the page that actually has a server element', async () => {
    const { getRscData, ssr } = await render('/blog/hello');

    expect(getRscData).toHaveBeenCalledTimes(1);
    expect(ssr?.rscData).toEqual({ serverData: { resolved: true } });
  });

  it('still asks when the server element is buried under plain containers', async () => {
    const { getRscData } = await render('/about');

    expect(getRscData).toHaveBeenCalledTimes(1);
  });

  // Pins the negative test below to the gate rather than to a route that failed to match: the root path resolves to
  // the same page in both, and the only thing that differs is what is on it.
  it('asks for the root page when that is the one with the server element', async () => {
    const { getRscData } = await render('/', { homeRuntime: 'server' });

    expect(getRscData).toHaveBeenCalledTimes(1);
  });

  it('never reaches the adapter for a page of its own, even though another page has a provider', async () => {
    const { getRscData, ssr } = await render('/');

    expect(getRscData).not.toHaveBeenCalled();
    // A payload all the same, and an empty one: a client told nothing arrived treats it as still to fetch.
    expect(ssr?.rscData).toEqual({ serverData: {} });
    expect(ssr?.rscPath).toBe('/_rsc');
  });

  it('never reaches the adapter when the URL matches no page at all', async () => {
    const { getRscData, ssr } = await render('/nothing/here');

    expect(getRscData).not.toHaveBeenCalled();
    expect(ssr?.rscData).toEqual({ serverData: {} });
  });

  it('never reaches the adapter for a schema that opted out, server elements or not', async () => {
    const { getRscData } = await render('/blog/hello', { rsc: { enabled: false } });

    expect(getRscData).not.toHaveBeenCalled();
  });

  it('never reaches the adapter when the deployment publishes no endpoint', async () => {
    const { getRscData, ssr } = await render('/blog/hello', { configRsc: { enabled: false } });

    expect(getRscData).not.toHaveBeenCalled();
    expect(ssr?.rscPath).toBeUndefined();
    // Nothing to seed and nothing to fetch: the client is told the feature has no server behind it.
    expect(ssr?.rscData).toBeUndefined();
  });

  it('renders a space that configured no adapter at all', async () => {
    const { ssr } = await render('/blog/hello', { withAdapter: false });

    expect(ssr?.rscPath).toBeUndefined();
    expect(ssr?.rscData).toBeUndefined();
  });

  it('reads the space once per render, whether or not the adapter is asked', async () => {
    const resolved = await render('/blog/hello');
    const skipped = await render('/');

    expect(resolved.getOfflineData).toHaveBeenCalledTimes(1);
    expect(skipped.getOfflineData).toHaveBeenCalledTimes(1);
  });

  it('bills the schema read to `schema`, and reports no rsc phase when none happened', async () => {
    const skipped = await render('/');
    expect(skipped.timing).toContain('schema;dur=');
    expect(skipped.timing).not.toContain('rsc;dur=');

    // And when it does happen it is timed apart from the read it joins, not on top of it.
    const resolved = await render('/blog/hello');
    expect(resolved.timing).toContain('rsc;dur=');
  });
});

describe('prepareRender / the document the crawler reads', () => {
  it('titles the document with what the addressed page declares', async () => {
    const { templateParams } = await render('/');

    expect(templateParams.title).toBe('Home — test space');
    expect(templateParams.description).toBe('What the home page says about itself.');
  });

  it('falls back for a page that declares nothing, rather than titling it after another page', async () => {
    const { templateParams } = await render('/about');

    expect(templateParams.title).toBe('Plitzi App');
    expect(templateParams.description).toBeUndefined();
  });

  it('resolves the page even when RSC is off, since the title does not depend on it', async () => {
    const { templateParams } = await render('/', { rsc: { enabled: false } });

    expect(templateParams.title).toBe('Home — test space');
  });

  it('leaves a URL that matches no page on the fallback', async () => {
    const { templateParams } = await render('/nowhere');

    expect(templateParams.title).toBe('Plitzi App');
  });
});

describe('prepareRender / debugging in a render nobody is watching', () => {
  it('authorizes debugging on an ordinary render of a deployment that asked for it', async () => {
    const { componentProps, templateParams } = await render('/', { debugMode: true });

    expect(componentProps.debugMode).toBe(true);
    expect(templateParams.debugMode).toBe(true);
  });

  it('refuses it on a preview render, which exists to be captured as a picture', async () => {
    const { componentProps, templateParams } = await render('/', { debugMode: true, query: { __pt: 'tok' } });

    expect(componentProps.debugMode).toBe(false);
    expect(templateParams.debugMode).toBe(false);
  });
});
