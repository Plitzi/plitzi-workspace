import { describe, expect, it } from 'vitest';

import { compileTemplate } from './template';

import type { FontHead } from '@plitzi/sdk-shared';

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

  it('does not repeat a preconnect the document already makes for its icon font', () => {
    const html = head(
      render({
        preconnect: [
          { href: 'https://fonts.googleapis.com' },
          { href: 'https://fonts.gstatic.com', crossorigin: true }
        ],
        links: [],
        faces: '',
        origins: []
      })
    );

    expect(html.match(/rel="preconnect" href="https:\/\/fonts\.gstatic\.com"/g)).toHaveLength(1);
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

  /** The blocking script this replaced: nothing in the head runs to settle the theme any more. */
  it('ships no script for a theme the server already knew', () => {
    expect(withTheme('dark')).not.toContain('classList.add');
    expect(withTheme('dark')).not.toContain('themeBoot');
  });
});
