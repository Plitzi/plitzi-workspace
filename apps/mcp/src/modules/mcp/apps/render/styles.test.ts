import { describe, expect, it } from 'vitest';

import { iconFontCss, splitFontFaces, widgetCss } from './styles';

describe('the widget stylesheet (what every widget pays for before it paints)', () => {
  it('lifts every @font-face out, keeping the rest of the sheet byte for byte', () => {
    const css = 'a{color:red}@font-face{font-family:"X";src:url(data:font/woff2;base64,AAA)}b{color:blue}';

    const { base, fonts } = splitFontFaces(css);

    expect(base).toBe('a{color:red}b{color:blue}');
    expect(fonts).toBe('@font-face{font-family:"X";src:url(data:font/woff2;base64,AAA)}');
  });

  it('ends a block on ITS closing brace, so a nested one cannot swallow the rest of the sheet', () => {
    const css = '@font-face{font-family:"X"}@media (min-width:1px){a{color:red}}';

    const { base, fonts } = splitFontFaces(css);

    expect(fonts).toBe('@font-face{font-family:"X"}');
    expect(base).toBe('@media (min-width:1px){a{color:red}}');
  });

  it('leaves a sheet without fonts untouched', () => {
    const { base, fonts } = splitFontFaces('a{color:red}');

    expect(base).toBe('a{color:red}');
    expect(fonts).toBe('');
  });

  // The whole point: the SDK's icon fonts are base64 woff2, and they are the single heaviest thing in the page.
  it('keeps the SDK icon fonts out of the page and hands them over separately', () => {
    expect(widgetCss()).not.toContain('@font-face');
    expect(widgetCss()).toContain('tailwindcss');
    expect(iconFontCss()).toContain('Font Awesome');
    expect(iconFontCss().length).toBeGreaterThan(100_000);
  });
});
