import { describe, expect, it } from 'vitest';

import { PLUGIN_CSS_LAYER, RUNTIME_CSS_LAYER } from './cssLayers';
import { styleSheetCss, styleSheetHref, styleSheetLinkable } from './runtimeStyle';

describe('the stylesheet a server-rendered page links', () => {
  it('is linked when its text is the same for every request', () => {
    expect(styleSheetLinkable('.a{color:red}')).toBe(true);
    // A file is not HTML: what could not travel inside a `<style>` travels in one as it is.
    expect(styleSheetLinkable('.a{content:"</style>"}\r\n.b{}')).toBe(true);
  });

  // The token is replaced by the variables as each request resolves them, so no one file holds it.
  it('stays in the page when a token in it is replaced per request', () => {
    expect(styleSheetLinkable('.a{color:{{ brand.primary }}}')).toBe(false);
    expect(styleSheetLinkable('')).toBe(false);
  });

  it('says the layers’ order before the space’s rules, in the runtime layer', () => {
    expect(styleSheetCss('.a{}')).toBe(
      `@layer ${PLUGIN_CSS_LAYER}, ${RUNTIME_CSS_LAYER};@layer ${RUNTIME_CSS_LAYER}{.a{}}`
    );
  });

  it('is served under its name', () => {
    expect(styleSheetHref('abc')).toBe('/_plitzi/style/abc.css');
  });
});
