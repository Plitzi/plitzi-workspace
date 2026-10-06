import { describe, expect, it } from 'vitest';

import { iconFontCss, inlineIconFonts, widgetCss } from './styles';

describe('the widget stylesheet (what every widget pays for before it paints)', () => {
  it('inlines each font the icon sheet names, and nothing else', () => {
    const css = '@font-face{src:url(webfonts/fa-solid-900.woff2)}.fa-x{background:url(a.png)}';

    expect(inlineIconFonts(css, () => Buffer.from('woff'))).toBe(
      '@font-face{src:url(data:font/woff2;base64,d29mZg==)}.fa-x{background:url(a.png)}'
    );
  });

  it('keeps the SDK icon fonts out of the page and hands them over separately', () => {
    expect(widgetCss()).not.toContain('@font-face');
    expect(widgetCss()).toContain('tailwindcss');
    expect(iconFontCss()).toContain('Font Awesome');
    expect(iconFontCss()).not.toContain('url(webfonts/');
    expect(iconFontCss()).toContain('data:font/woff2;base64,');
  });
});
