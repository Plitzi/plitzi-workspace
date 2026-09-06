import { describe, expect, it } from 'vitest';

import { fallbackForFamily, fontsFromCss } from './fontsFromCss';

import type { FontCatalogLookup } from './fontsFromCss';

const catalog: FontCatalogLookup = family =>
  family === 'Lato'
    ? { weights: [100, 300, 400, 700, 900], styles: ['normal', 'italic'], category: 'sans-serif' }
    : undefined;

describe('fontsFromCss', () => {
  it('declares nothing for a stylesheet that only names stacks everyone already has', () => {
    expect(fontsFromCss('.a{font-family:Arial, sans-serif;}.b{font-family:ui-monospace;}')).toEqual([]);
  });

  it('declares a family the catalog knows as a Google font, at the weights the page asks for', () => {
    const css = '.a{font-family:Lato;font-weight:400;}.b{font-family:Lato;font-weight:900;}';
    expect(fontsFromCss(css, catalog)).toEqual([
      {
        source: 'google',
        family: 'Lato',
        fallback: 'system-ui, sans-serif',
        weights: [400, 900],
        styles: ['normal', 'italic'],
        display: 'swap'
      }
    ]);
  });

  it('falls back to the usual two when the page names no weight at all', () => {
    expect(fontsFromCss('.a{font-family:Lato;}', catalog)[0].weights).toEqual([400, 700]);
  });

  it('declares an unrecognised family as a system stack, which is what it renders as either way', () => {
    expect(fontsFromCss('.a{font-family:"Founders Grotesk", sans-serif;}')).toEqual([
      {
        source: 'system',
        family: 'Founders Grotesk',
        fallback: 'system-ui, sans-serif',
        weights: [400, 700],
        styles: ['normal', 'italic']
      }
    ]);
  });

  it('never declares a family twice, however many rules name it', () => {
    expect(fontsFromCss('.a{font-family:Lato;}.b{font-family:Lato;}', catalog)).toHaveLength(1);
  });
});

describe('fallbackForFamily', () => {
  it('follows the catalog category when there is one', () => {
    expect(fallbackForFamily('Playfair Display', 'serif')).toBe('Georgia, serif');
    expect(fallbackForFamily('Roboto Mono', 'monospace')).toBe('ui-monospace, monospace');
  });

  it('reads the name when there is not', () => {
    expect(fallbackForFamily('JetBrains Mono')).toBe('ui-monospace, monospace');
    expect(fallbackForFamily('Some Serif')).toBe('Georgia, serif');
    expect(fallbackForFamily('Anything Else')).toBe('system-ui, sans-serif');
  });
});
