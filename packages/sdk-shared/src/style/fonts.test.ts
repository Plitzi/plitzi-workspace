import { describe, expect, it } from 'vitest';

import {
  availableFonts,
  familiesInCss,
  fontFamilyStack,
  fontsToHead,
  fontUrlResolver,
  googleCss2Url,
  primaryFamily,
  googleTextSubsetUrl,
  isSafeFontUrl
} from './fonts';

import type { GoogleFont, HostedFont, RemoteFont, SpaceFont, SystemFont } from '../types/StyleTypes';

const cdn = (path: string) => `https://cdn.example.test/fonts/${path}`;

const system: SystemFont = {
  source: 'system',
  family: 'Arial',
  fallback: 'sans-serif',
  weights: [400, 700],
  styles: ['normal']
};

const lato: GoogleFont = {
  source: 'google',
  family: 'Lato',
  fallback: 'sans-serif',
  weights: [700, 400],
  styles: ['normal']
};

describe('isSafeFontUrl', () => {
  it('accepts plain https', () => {
    expect(isSafeFontUrl('https://cdn.example.test/a.woff2')).toBe(true);
  });

  it('rejects anything that is not https, including script and inline data', () => {
    expect(isSafeFontUrl('http://cdn.example.test/a.woff2')).toBe(false);
    expect(isSafeFontUrl('//cdn.example.test/a.woff2')).toBe(false);
    expect(isSafeFontUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeFontUrl('data:font/woff2;base64,AAAA')).toBe(false);
    expect(isSafeFontUrl('not a url')).toBe(false);
  });

  it('rejects credentials in the authority', () => {
    expect(isSafeFontUrl('https://user:pass@cdn.example.test/a.woff2')).toBe(false);
  });
});

describe('fontFamilyStack', () => {
  it('leaves a bare identifier unquoted and appends the fallback', () => {
    expect(fontFamilyStack({ ...system, family: 'Arial' })).toBe('Arial, sans-serif');
  });

  it('quotes a name that is not a single identifier', () => {
    expect(fontFamilyStack({ ...lato, family: 'Open Sans' })).toBe('"Open Sans", sans-serif');
  });

  it('escapes a quote in the family name', () => {
    expect(fontFamilyStack({ ...lato, family: 'Ro"bot' })).toBe('"Ro\\"bot", sans-serif');
  });
});

describe('googleCss2Url', () => {
  it('sorts weights ascending and families alphabetically, so the URL is a stable cache key', () => {
    const rubik: GoogleFont = { ...lato, family: 'Rubik', weights: [300] };
    expect(googleCss2Url([rubik, lato])).toBe(
      'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&family=Rubik:wght@300&display=swap'
    );
  });

  it('emits ital,wght tuples in ascending order when the family has italics', () => {
    expect(googleCss2Url([{ ...lato, styles: ['normal', 'italic'] }])).toBe(
      'https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,700;1,400;1,700&display=swap'
    );
  });

  it('encodes a space in the family name the way the API expects', () => {
    expect(googleCss2Url([{ ...lato, family: 'Open Sans', weights: [400] }])).toContain('family=Open+Sans:wght@400');
  });

  it('honours a shared display and falls back to swap when families disagree', () => {
    expect(googleCss2Url([{ ...lato, display: 'optional' }])).toContain('&display=optional');
    expect(
      googleCss2Url([
        { ...lato, display: 'optional' },
        { ...lato, family: 'Rubik', display: 'block' }
      ])
    ).toContain('&display=swap');
  });

  it('defaults an empty weight list to 400 rather than emitting an invalid axis', () => {
    expect(googleCss2Url([{ ...lato, weights: [] }])).toContain('family=Lato:wght@400');
  });
});

describe('googleTextSubsetUrl', () => {
  it('asks only for the glyphs of the names it draws', () => {
    expect(googleTextSubsetUrl(['Lato', 'Open Sans'], 'LatoOpen Sans')).toBe(
      'https://fonts.googleapis.com/css2?family=Lato&family=Open+Sans&text=LatoOpen%20Sans&display=swap'
    );
  });
});

describe('fontsToHead', () => {
  it('asks for nothing when every family is a system stack', () => {
    expect(fontsToHead([system], cdn)).toEqual({ preconnect: [], links: [], faces: '', origins: [] });
  });

  it('collapses every google family into one request and preconnects both origins', () => {
    const head = fontsToHead([lato, { ...lato, family: 'Rubik' }, system], cdn);
    expect(head.links).toEqual([{ href: googleCss2Url([lato, { ...lato, family: 'Rubik' }]), rel: 'stylesheet' }]);
    expect(head.preconnect).toEqual([
      { href: 'https://fonts.googleapis.com' },
      { href: 'https://fonts.gstatic.com', crossorigin: true }
    ]);
  });

  it('preloads the google stylesheet, since a linked sheet hides the file URLs', () => {
    const head = fontsToHead([{ ...lato, preload: true }], cdn);
    expect(head.links[0]).toEqual({ href: googleCss2Url([lato]), rel: 'preload', as: 'style' });
    expect(head.links[1].rel).toBe('stylesheet');
  });

  it('links a remote stylesheet as-is and records its origin', () => {
    const remote: RemoteFont = {
      source: 'remote',
      family: 'Founders',
      fallback: 'serif',
      weights: [400],
      styles: ['normal'],
      stylesheet: 'https://use.typekit.test/abc.css'
    };
    const head = fontsToHead([remote], cdn);
    expect(head.links).toEqual([{ href: 'https://use.typekit.test/abc.css', rel: 'stylesheet' }]);
    expect(head.origins).toEqual(['https://use.typekit.test']);
    expect(head.preconnect).toEqual([{ href: 'https://use.typekit.test' }]);
    expect(head.faces).toBe('');
  });

  it('writes faces for remote files and preloads them with crossorigin', () => {
    const remote: RemoteFont = {
      source: 'remote',
      family: 'Founders',
      fallback: 'serif',
      weights: [400],
      styles: ['normal'],
      preload: true,
      files: [{ weight: 400, style: 'normal', format: 'woff2', url: 'https://cdn.acme.test/f.woff2' }]
    };
    const head = fontsToHead([remote], cdn);
    expect(head.faces).toBe(
      '@font-face{font-family:"Founders";font-style:normal;font-weight:400;font-display:swap;' +
        'src:url("https://cdn.acme.test/f.woff2") format("woff2");}'
    );
    expect(head.links).toEqual([
      { href: 'https://cdn.acme.test/f.woff2', rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: true }
    ]);
  });

  it('drops a remote URL that is not plain https instead of putting it in the document', () => {
    const remote: RemoteFont = {
      source: 'remote',
      family: 'Evil',
      fallback: 'serif',
      weights: [400],
      styles: ['normal'],
      files: [
        { weight: 400, style: 'normal', format: 'woff2', url: 'javascript:alert(1)' },
        { weight: 700, style: 'normal', format: 'woff2', url: 'https://cdn.acme.test/ok.woff2' }
      ]
    };
    const head = fontsToHead([remote], cdn);
    expect(head.faces).toContain('https://cdn.acme.test/ok.woff2');
    expect(head.faces).not.toContain('javascript:');
  });

  it('resolves a hosted path through the caller, so one manifest serves cloud, disk and export', () => {
    const hosted: HostedFont = {
      source: 'hosted',
      family: 'Acme Grotesk',
      fallback: 'sans-serif',
      weights: [400],
      styles: ['normal'],
      display: 'optional',
      files: [{ weight: 400, style: 'normal', format: 'woff2', path: 'acme-400.woff2', unicodeRange: 'U+0-FF' }]
    };
    expect(fontsToHead([hosted], cdn).faces).toBe(
      '@font-face{font-family:"Acme Grotesk";font-style:normal;font-weight:400;font-display:optional;' +
        'src:url("https://cdn.example.test/fonts/acme-400.woff2") format("woff2");unicode-range:U+0-FF;}'
    );
    expect(fontsToHead([hosted], path => `/fonts/${path}`).faces).toContain('src:url("/fonts/acme-400.woff2")');
  });

  it('marks a file-serving origin crossorigin, since a font is always fetched in CORS mode', () => {
    const hosted: HostedFont = {
      source: 'hosted',
      family: 'Acme',
      fallback: 'sans-serif',
      weights: [400],
      styles: ['normal'],
      files: [{ weight: 400, style: 'normal', format: 'woff2', path: 'a.woff2' }]
    };
    expect(fontsToHead([hosted], cdn).preconnect).toEqual([{ href: 'https://cdn.example.test', crossorigin: true }]);
  });

  it('asks for no connection at all when the files are same-origin', () => {
    const hosted: HostedFont = {
      source: 'hosted',
      family: 'Acme',
      fallback: 'sans-serif',
      weights: [400],
      styles: ['normal'],
      files: [{ weight: 400, style: 'normal', format: 'woff2', path: 'a.woff2' }]
    };
    expect(fontsToHead([hosted], path => `/fonts/${path}`).preconnect).toEqual([]);
  });

  it('keeps preloads ahead of stylesheets so the fetch starts before the sheet is parsed', () => {
    const fonts: SpaceFont[] = [
      lato,
      {
        source: 'hosted',
        family: 'Acme',
        fallback: 'sans-serif',
        weights: [400],
        styles: ['normal'],
        preload: true,
        files: [{ weight: 400, style: 'normal', format: 'woff2', path: 'a.woff2' }]
      }
    ];
    expect(fontsToHead(fonts, cdn).links.map(link => link.rel)).toEqual(['preload', 'stylesheet']);
  });
});

describe('availableFonts', () => {
  it('offers the system stacks alongside what the space declared', () => {
    const families = availableFonts([lato]).map(font => font.family);
    expect(families[0]).toBe('Lato');
    expect(families).toContain('system-ui');
    expect(families).toContain('Georgia');
  });

  it('lets a space override a system family with one it declared itself', () => {
    const own: HostedFont = {
      source: 'hosted',
      family: 'Arial',
      fallback: 'sans-serif',
      weights: [400],
      styles: ['normal'],
      files: [{ weight: 400, style: 'normal', format: 'woff2', path: 'arial.woff2' }]
    };
    const arials = availableFonts([own]).filter(font => font.family === 'Arial');
    expect(arials).toHaveLength(1);
    expect(arials[0].source).toBe('hosted');
  });
});

describe('fontUrlResolver', () => {
  it('serves a font from this server when the deployment names nowhere else', () => {
    expect(fontUrlResolver()('lato-400.woff2')).toBe('/fonts/lato-400.woff2');
  });

  it('points at a CDN when the deployment has one', () => {
    expect(fontUrlResolver('https://cdn.example.com/fonts')('a.woff2')).toBe('https://cdn.example.com/fonts/a.woff2');
  });

  it('joins with exactly one slash however the two sides are written', () => {
    expect(fontUrlResolver('https://cdn.example.com/fonts/')('/a.woff2')).toBe('https://cdn.example.com/fonts/a.woff2');
  });
});

describe('fontsToHead / what a family name may not do', () => {
  const breakout = (family: string) => {
    const font: HostedFont = {
      source: 'hosted',
      family,
      fallback: 'sans-serif',
      weights: [400],
      styles: ['normal'],
      files: [{ weight: 400, style: 'normal', format: 'woff2', path: 'a.woff2' }]
    };

    return fontsToHead([font], cdn).faces;
  };

  it('cannot close the style element it is written into', () => {
    const faces = breakout('x</style><script>alert(1)</script>');
    expect(faces).not.toContain('</style>');
    expect(faces).not.toContain('<script>');
    expect(faces).toContain('\\3c ');
  });

  it('drops a unicode-range that is not one, rather than writing it into the declaration', () => {
    const font: HostedFont = {
      source: 'hosted',
      family: 'Acme',
      fallback: 'sans-serif',
      weights: [400],
      styles: ['normal'],
      files: [{ weight: 400, style: 'normal', format: 'woff2', path: 'a.woff2', unicodeRange: '}body{display:none' }]
    };
    expect(fontsToHead([font], cdn).faces).not.toContain('display:none');
  });
});

describe('familiesInCss', () => {
  it('names the family each declaration chooses, quoted or not', () => {
    expect(familiesInCss('.a{font-family:Lato, sans-serif;}.b{font-family:"Open Sans",Arial;}')).toEqual([
      'Lato',
      'Open Sans'
    ]);
  });

  it('leaves out the rest of a stack, which is a fallback chain and not a choice', () => {
    expect(familiesInCss('.a{font-family:ui-monospace, SFMono-Regular, Menlo, monospace;}')).toEqual([]);
    expect(familiesInCss('.a{font-family:"JetBrains Mono", SFMono-Regular, monospace;}')).toEqual(['JetBrains Mono']);
  });

  it('leaves out the generics and the CSS-wide keywords, which load nothing', () => {
    expect(familiesInCss('.a{font-family:ui-monospace, monospace;}.b{font-family:inherit;}')).toEqual([]);
  });

  it('skips a value built from a variable, whose answer belongs to the variable', () => {
    expect(familiesInCss('.a{font-family:var(--font-heading), serif;}')).toEqual([]);
  });

  it('reports a family once however many rules use it', () => {
    expect(familiesInCss('.a{font-family:Lato;}.b{font-family:Lato;}')).toEqual(['Lato']);
  });
});

describe('primaryFamily', () => {
  it('takes the family a stack leads with', () => {
    expect(primaryFamily('Lato, sans-serif')).toBe('Lato');
    expect(primaryFamily('"Open Sans", Arial, sans-serif')).toBe('Open Sans');
  });

  it('answers a bare family as itself, which is what older documents hold', () => {
    expect(primaryFamily('Arial')).toBe('Arial');
  });

  it('answers nothing for nothing', () => {
    expect(primaryFamily('')).toBe('');
  });
});
