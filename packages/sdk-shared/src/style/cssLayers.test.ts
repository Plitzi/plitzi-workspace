import { describe, expect, it } from 'vitest';

import { inPluginLayer, PLUGIN_CSS_LAYER } from './cssLayers';

describe('inPluginLayer', () => {
  it('puts a plugin’s rules in its layer', () => {
    expect(inPluginLayer('.marker{display:flex}')).toBe(`@layer ${PLUGIN_CSS_LAYER}{.marker{display:flex}}`);
  });

  /** `@charset` and `@import` must come first, and cannot sit in a block: an import joins the layer by itself. */
  it('leaves what must come first outside, and imports into the layer', () => {
    expect(
      inPluginLayer('@charset "UTF-8";@import url(https://fonts.example/a.css) screen;/* note */.a{color:red}')
    ).toBe(
      `@charset "UTF-8";@import url(https://fonts.example/a.css) layer(${PLUGIN_CSS_LAYER}) screen;/* note */` +
        `@layer ${PLUGIN_CSS_LAYER}{.a{color:red}}`
    );
    expect(inPluginLayer('@import "x.css" layer(mine);')).toBe('@import "x.css" layer(mine);');
  });

  it('wraps once', () => {
    const once = inPluginLayer('.a{color:red}');

    expect(inPluginLayer(once)).toBe(once);
  });
});
