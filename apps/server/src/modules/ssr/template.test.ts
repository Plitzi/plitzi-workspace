import { describe, expect, it } from 'vitest';

import { compileTemplate } from './template';

import type { FontHead, PluginEntry } from '@plitzi/sdk-shared';

const render = (fonts?: FontHead) => compileTemplate()({ html: '<div />', offlineData: '{}', ssrOnly: true, fonts });

const head = (html: string) => html.slice(0, html.indexOf('</head>'));

describe('the SSR document / fonts', () => {
  it('renders without a manifest, the way a host that passes none gets a page anyway', () => {
    expect(render()).toContain('<div />');
  });

  it('links what the manifest asks for, and declares the faces it carries itself', () => {
    const html = head(
      render({
        preconnect: [{ href: 'https://cdn.acme.test', crossorigin: true }],
        links: [{ href: 'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap', rel: 'stylesheet' }],
        faces: '@font-face{font-family:"Acme";src:url(/fonts/a.woff2) format("woff2");}',
        origins: ['https://cdn.acme.test']
      })
    );

    expect(html).toContain('<link rel="preconnect" href="https://cdn.acme.test" crossorigin />');
    // The ampersand is entity-encoded in the attribute, which is what an HTML parser decodes back to `&`. The
    // asset rail this replaces put the entity in the URL string itself, so Google saw a parameter named
    // `amp;text` and served every family in full — at one weight.
    expect(html).toContain('href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&amp;display=swap"');
    expect(html).toContain(
      '<style data-plitzi-fonts>@font-face{font-family:"Acme";src:url(/fonts/a.woff2) format("woff2");}</style>'
    );
  });

  it('preloads a face with the crossorigin its CORS fetch needs', () => {
    const html = head(
      render({
        preconnect: [],
        links: [
          { href: '/fonts/a.woff2', rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: true },
          { href: '/fonts/sheet.css', rel: 'stylesheet' }
        ],
        faces: '',
        origins: []
      })
    );

    expect(html).toMatch(/rel="preload"[\s\S]*?href="\/fonts\/a\.woff2"[\s\S]*?as="font"[\s\S]*?crossorigin/);
    expect(html.indexOf('/fonts/a.woff2')).toBeLessThan(html.indexOf('/fonts/sheet.css'));
  });

  it('reaches a font host only when the space uses one, and once', () => {
    const fonts = (preconnect: { href: string; crossorigin?: boolean }[]) =>
      head(render({ preconnect, links: [], faces: '', origins: [] }));
    const google = fonts([
      { href: 'https://fonts.googleapis.com' },
      { href: 'https://fonts.gstatic.com', crossorigin: true }
    ]);

    expect(google.match(/rel="preconnect" href="https:\/\/fonts\.gstatic\.com"/g)).toHaveLength(1);
    expect(fonts([])).not.toContain('fonts.gstatic.com');
    expect(fonts([])).not.toContain('fonts.googleapis.com');
  });
});

describe('the SSR document / icons', () => {
  it('links the icon sheet after the SDK stylesheet, so the layer order the SDK declares is the one that holds', () => {
    const html = head(
      compileTemplate()({
        html: '<div />',
        offlineData: '{}',
        ssrOnly: true,
        cssPath: '/sdk-assets/plitzi-sdk.css',
        iconsCssPath: '/sdk-assets/plitzi-sdk-icons.css'
      })
    );

    expect(html).toContain('<link href="/sdk-assets/plitzi-sdk-icons.css" rel="stylesheet" />');
    expect(html.indexOf('plitzi-sdk-icons.css')).toBeGreaterThan(html.lastIndexOf('plitzi-sdk.css'));
  });
});

describe('the SSR document / arrivals on screen', () => {
  it('sees what is on screen as the page is parsed, before any module, and on a page with no script too', () => {
    const html = compileTemplate()({ html: '<div />', offlineData: '{}', ssrOnly: true });
    const early = html.indexOf('[data-motion-on="view"]:not([data-motion-seen])');

    expect(early).toBeGreaterThan(html.indexOf('id="plitzi"'));
    expect(html).toContain('new IntersectionObserver');
    expect(html).not.toContain('type="module"');
  });
});

describe('the SSR document / the theme', () => {
  const withTheme = (themeClass?: string) =>
    compileTemplate()({ html: '<div />', offlineData: '{}', ssrOnly: true, themeClass });

  it('wears the class on the document itself, before anything is drawn', () => {
    expect(withTheme('dark')).toContain('<html lang="en" class="dark">');
  });

  /** No class is `system`: the stylesheet's `prefers-color-scheme` queries are guarded on the absence of one. */
  it('writes no attribute at all when there is no class', () => {
    expect(withTheme()).toContain('<html lang="en">');
  });

  /** The server already knew the theme, so nothing in the head runs to settle it before the first paint. */
  it('ships no script for a theme the server already knew', () => {
    expect(withTheme('dark')).not.toContain('classList.add');
  });
});

describe('the SSR document / bootstrap', () => {
  const bootstrap = (offlineData: string, plugins?: PluginEntry[]) =>
    compileTemplate()({ html: '<div />', offlineData, jsPath: '/sdk-assets/plitzi-sdk.js', plugins });
  const dataBlock = (html: string) =>
    /<script type="application\/json" id="plitzi-ssr-data">([\s\S]*?)<\/script>/.exec(html)?.[1];

  it('carries the payload as a JSON block the module parses, not as a literal in the module', () => {
    const payload = '{"offlineData":{"schema":{"settings":{"title":"\\u003c/script\\u003e"}}},"offlineMode":true}';
    const html = bootstrap(payload);

    expect(dataBlock(html)).toBe(payload);
    expect(JSON.parse(dataBlock(html) ?? '')).toEqual({
      offlineData: { schema: { settings: { title: '</script>' } } },
      offlineMode: true
    });
    expect(html).toContain('JSON.parse(__plitziData.textContent)');
    expect(html).not.toContain(`render('plitzi', ${payload}`);
  });

  it('hands the plugins to the same render call, and none when there are none', () => {
    expect(bootstrap('{}')).toMatch(/render\('plitzi', __plitziParams, __plitziPlugins/);
    expect(
      bootstrap('{}', [
        { name: 'chart', keyName: 'chart', varName: 'chart', js: '/sdk-plugins/chart/index.js', props: {} }
      ])
      // eslint-disable-next-line quotes -- the expected source quotes its own path, which reads best in the other quotes
    ).toContain("import { default as chart } from '/sdk-plugins/chart/index.js'");
  });

  it('sends a plugin the page does not draw as its declaration, its code and stylesheet loaded when drawn', () => {
    const html = bootstrap('{}', [
      {
        name: 'chart',
        keyName: 'chart',
        varName: 'chart',
        js: '/sdk-plugins/chart/index.js',
        css: '/c.css',
        props: {}
      },
      {
        name: 'editor',
        keyName: 'editor',
        varName: 'editor',
        js: '/sdk-plugins/editor/index.js',
        css: '/e.css',
        props: { label: '</script>' },
        ssr: true,
        deferred: { version: '2.0.0', plugins: { editorToolbar: {} } }
      }
    ]);

    expect(html).toContain('data-plitzi-plugin="chart"');
    expect(html).not.toContain('/e.css" rel="stylesheet"');
    expect(html).not.toContain('import { default as editor }');
    expect(html).toContain(
      // eslint-disable-next-line quotes -- the expected source quotes its own path, which reads best in the other quotes
      `'editor': {load: () => import('/sdk-plugins/editor/index.js'), css: "/e.css", declaration: {"version":"2.0.0","plugins":{"editorToolbar":{}}}`
    );
    expect(html).not.toContain('"</script>"');
  });

  it('ships no bootstrap for a page that renders on the server only', () => {
    expect(compileTemplate()({ html: '<div />', offlineData: '{}', ssrOnly: true })).not.toContain('plitzi-ssr-data');
  });
});
