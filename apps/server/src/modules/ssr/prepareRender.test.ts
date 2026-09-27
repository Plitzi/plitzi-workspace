/* eslint-disable quotes */
import { describe, it, expect, vi } from 'vitest';

import { prepareRender } from './prepareRender';
import { RequestMetrics } from '../../helpers/metrics';

import type { PluginManager } from '../../plugins/manager';
import type {
  Element,
  OfflineDataRaw,
  SchemaRsc,
  SpaceFont,
  SSRFontsConfig,
  SSRPageServerConfig,
  SSRRequest
} from '@plitzi/sdk-shared';

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
  homeRuntime: 'server' | 'client' = 'client',
  fonts: SpaceFont[] = [],
  spaceDebugMode = false,
  defaultTheme?: 'dark' | 'light' | 'system',
  settings: Record<string, unknown> = {}
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
      settings: { customCss: '', ...(spaceDebugMode ? { debugMode: true } : {}), ...settings },
      rsc
    },
    plugins: [],
    style: {
      cache: '',
      variables: [],
      fonts,
      ...(defaultTheme ? { theme: { default: defaultTheme, schemes: ['light', 'dark'] } } : {})
    }
  }) as unknown as OfflineDataRaw;

const request = (path: string, query: Record<string, string> = {}, cookie?: string): SSRRequest =>
  ({
    method: 'GET',
    path,
    search: '',
    url: path,
    protocol: 'https',
    hostname: 'x.test',
    headers: cookie ? { cookie } : {},
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
  /** What the space's own settings say about dev tools on its published site. */
  spaceDebugMode?: boolean;
  /** The visitor's own preference, which rides on the request. */
  cookie?: string;
  query?: Record<string, string>;
  /** What metering decided for this render. */
  degrade?: boolean;
  /** What the space declares, and where this deployment serves uploaded files from. */
  fonts?: SpaceFont[];
  fontsConfig?: SSRFontsConfig;
  /** The theme the space's style says a visitor starts in. */
  defaultTheme?: 'dark' | 'light' | 'system';
  /** The space's own settings, over the fixture's. */
  settings?: Record<string, unknown>;
};

const render = async (
  path: string,
  {
    rsc = { enabled: true },
    configRsc,
    withAdapter = true,
    homeRuntime,
    debugMode,
    spaceDebugMode,
    cookie,
    query,
    degrade,
    fonts,
    fontsConfig,
    defaultTheme,
    settings
  }: Options = {}
) => {
  const getRscData = vi.fn().mockResolvedValue({ serverData: { resolved: true } });
  const getOfflineData = vi
    .fn()
    .mockResolvedValue(offlineData(rsc, homeRuntime, fonts, spaceDebugMode, defaultTheme, settings));
  const metrics = new RequestMetrics();
  const config = {
    environment: 'production',
    assetVersion: '1',
    autoLoadSchemaPlugins: false,
    rsc: configRsc,
    debugMode,
    fonts: fontsConfig,
    adapters: {
      getOfflineData,
      getSpaceDeployment: () => Promise.resolve(undefined),
      ...(withAdapter ? { getRscData } : {})
    }
  } as unknown as SSRPageServerConfig;

  const req = request(path, query, cookie);
  if (degrade !== undefined) {
    (req.ctx as { meter?: { degrade: boolean } }).meter = { degrade };
  }

  const { componentProps, templateParams } = await prepareRender(
    req,
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

  /**
   * The two halves of the answer part ways here, and that is the point.
   *
   * A visitor who hid the panel gets a render without it — but the page still comes back saying debugging is
   * allowed, because that argument is what arms the shortcut and the console hint on the client. Sending the
   * product of the two instead left an SSR page with no way back at all: nothing on screen, a dead shortcut, and
   * a year-long cookie nobody could guess was the cause.
   */
  it('keeps a visitor who hid the panel able to bring it back', async () => {
    const { componentProps, templateParams } = await render('/', { debugMode: true, cookie: 'plitzi_debug=false' });

    expect(componentProps.debugMode).toBe(false);
    expect(templateParams.debugMode).toBe(true);
  });

  it('tells a page that was never authorized nothing, cookie or no cookie', async () => {
    const { componentProps, templateParams } = await render('/', { debugMode: false, cookie: 'plitzi_debug=true' });

    expect(componentProps.debugMode).toBe(false);
    expect(templateParams.debugMode).toBe(false);
  });

  /** An owner inspecting their own published site, on a server that left the decision to the space. */
  it('authorizes debugging for a space that switched dev tools on, when the server said nothing', async () => {
    const { componentProps, templateParams } = await render('/', { spaceDebugMode: true });

    expect(componentProps.debugMode).toBe(true);
    expect(templateParams.debugMode).toBe(true);
  });

  it('authorizes nothing for a space that did not ask, when the server said nothing', async () => {
    const { componentProps, templateParams } = await render('/');

    expect(componentProps.debugMode).toBe(false);
    expect(templateParams.debugMode).toBe(false);
  });

  it('lets a server that refused debugging keep refusing, whatever the space asks for', async () => {
    const { templateParams } = await render('/', { debugMode: false, spaceDebugMode: true });

    expect(templateParams.debugMode).toBe(false);
  });

  it('still refuses it on a preview render of a space that switched dev tools on', async () => {
    const { templateParams } = await render('/', { spaceDebugMode: true, query: { __pt: 'tok' } });

    expect(templateParams.debugMode).toBe(false);
  });
});

/**
 * What a render says when the account behind it is over quota.
 *
 * Only the server can state it: it is a fact about the account, not something the page or its settings decide.
 */
describe('prepareRender / a degraded render', () => {
  it('tells the client the account is over quota', async () => {
    const { componentProps, templateParams } = await render('/', { degrade: true });

    expect(componentProps.overQuota).toBe(true);
    // The browser hydrates from the same fact, so the notice does not appear and then vanish.
    expect(templateParams.offlineData).toContain('overQuota');
  });

  it('says nothing at all on a render that is within quota', async () => {
    const { componentProps, templateParams } = await render('/', { degrade: false });

    expect(componentProps.overQuota).toBeUndefined();
    expect(templateParams.offlineData).not.toContain('overQuota');
  });
});

describe('prepareRender / the fonts the document asks for', () => {
  const lato: SpaceFont = {
    source: 'google',
    family: 'Lato',
    fallback: 'sans-serif',
    weights: [400, 700],
    styles: ['normal']
  };

  it('asks for nothing when the space declares no family of its own', async () => {
    const { templateParams } = await render('/');
    expect(templateParams.fonts).toEqual({ preconnect: [], links: [], faces: '', origins: [] });
  });

  it("puts the space's google families in the document, which is the only place they load in time", async () => {
    const { templateParams } = await render('/', { fonts: [lato] });
    expect(templateParams.fonts?.links).toEqual([
      { href: 'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap', rel: 'stylesheet' }
    ]);
  });

  it('resolves an uploaded face against this deployment, not against the one that stored it', async () => {
    const hosted: SpaceFont = {
      source: 'hosted',
      family: 'Acme',
      fallback: 'sans-serif',
      weights: [400],
      styles: ['normal'],
      files: [{ weight: 400, style: 'normal', format: 'woff2', path: 'acme.woff2' }]
    };
    const cloud = await render('/', { fonts: [hosted], fontsConfig: { baseUrl: 'https://cdn.example.com/f' } });
    expect(cloud.templateParams.fonts?.faces).toContain('url("https://cdn.example.com/f/acme.woff2")');

    const selfHosted = await render('/', { fonts: [hosted] });
    expect(selfHosted.templateParams.fonts?.faces).toContain('url("/fonts/acme.woff2")');
  });
});

describe('prepareRender / the theme the visitor already chose', () => {
  it('paints the document class from the cookie, so no script has to run before the first paint', async () => {
    const { templateParams, componentProps } = await render('/', { cookie: 'theme=dark' });

    expect(templateParams.themeClass).toBe('dark');
    expect(componentProps.theme).toBe('dark');
  });

  /**
   * The class alone would settle what the page looks like. The value has to reach the browser as well: a space can
   * bind to `{{ theme.resolved }}`, and a client starting at `system` against a document rendered `dark` hydrates
   * different markup and throws away the tree it happens in.
   */
  it('hands the same value to the browser it rendered with', async () => {
    const { templateParams } = await render('/', { cookie: 'theme=light' });

    expect(templateParams.offlineData).toContain('"theme":"light"');
  });

  /**
   * `system` and "never chose" both write nothing — the absence is what lets the media queries answer.
   *
   * They are still not the same thing to the SDK, which is why only the class is shared: `system` is a choice the
   * visitor made and the provider is told about it, while a value nobody recognises is no choice at all.
   */
  it('writes no class for system, nor for a first visit', async () => {
    const chosen = await render('/', { cookie: 'theme=system' });

    expect(chosen.templateParams.themeClass).toBeUndefined();
    expect(chosen.componentProps.theme).toBe('system');

    for (const cookie of ['theme=sepia', 'theme=', undefined]) {
      const { templateParams, componentProps } = await render('/', { cookie });

      expect(templateParams.themeClass).toBeUndefined();
      expect(componentProps.theme).toBeUndefined();
    }
  });

  /**
   * A space that says it is dark by default IS dark on a first visit — painted so by the server, not corrected after.
   * `style.theme.default` was stored, edited in the builder and written by authoring, and nothing rendered with it.
   */
  it('starts a first visit in the theme the space declares as its default', async () => {
    const { templateParams, componentProps } = await render('/', { defaultTheme: 'dark' });

    expect(templateParams.themeClass).toBe('dark');
    expect(componentProps.theme).toBe('dark');
  });

  it('lets a choice the visitor made win over the default of the space', async () => {
    const { templateParams } = await render('/', { cookie: 'theme=light', defaultTheme: 'dark' });

    expect(templateParams.themeClass).toBe('light');
  });

  it('leaves a space whose default is system to the machine', async () => {
    const { templateParams, componentProps } = await render('/', { defaultTheme: 'system' });

    expect(templateParams.themeClass).toBeUndefined();
    expect(componentProps.theme).toBeUndefined();
  });
});

/**
 * The theme's reasoning, for the space's own kept state: web storage is the browser's alone, so what a visitor kept that
 * the first paint shows would be swapped in after hydration. The keys a space declares are read from a cookie instead,
 * drawn with, and handed to the page as its starting state.
 */
describe('prepareRender / the kept state the first paint shows', () => {
  const cookie = (values: Record<string, unknown>, owner = '') =>
    `plitzi_0_painted=${encodeURIComponent(JSON.stringify({ owner, values }))}`;
  const keeping = { keepState: true, paintedState: ['toolPick', 'name'] };

  it('renders with the declared keys, and hands the browser the same values', async () => {
    const { componentProps, templateParams } = await render('/', {
      cookie: cookie({ toolPick: 'star', name: 'Ada' }),
      settings: keeping
    });

    expect(componentProps.state).toEqual({ toolPick: 'star', name: 'Ada' });
    expect(templateParams.offlineData).toContain('"state":{"toolPick":"star","name":"Ada"}');
  });

  // The cookie is the visitor's to edit: a key the space does not declare is not the server's to render with.
  it('renders with nothing the space does not declare', async () => {
    const { componentProps } = await render('/', {
      cookie: cookie({ toolPick: 'star', admin: true }),
      settings: keeping
    });

    expect(componentProps.state).toEqual({ toolPick: 'star' });
  });

  it('reads nothing for a space that does not keep state', async () => {
    const { componentProps, templateParams } = await render('/', {
      cookie: cookie({ toolPick: 'star' }),
      settings: { paintedState: ['toolPick'] }
    });

    expect(componentProps.state).toBeUndefined();
    expect(templateParams.offlineData).not.toContain('"state":');
  });

  it('reads nothing for a space that declares no keys', async () => {
    const { componentProps } = await render('/', {
      cookie: cookie({ toolPick: 'star' }),
      settings: { keepState: true }
    });

    expect(componentProps.state).toBeUndefined();
  });
});
