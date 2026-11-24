import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { compile } from 'sass';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
// A package's stylesheet is found through its `exports`, as the build's bundler finds it: Sass alone reads none.
const css = compile(path.join(here, 'plitzi-sdk.scss'), {
  importers: [
    {
      findFileUrl: url => (url.startsWith('@plitzi/') ? pathToFileURL(require.resolve(url)) : null)
    }
  ]
}).css;

// The build turns `light-dark()` into custom properties a declared `color-scheme` switches on: a light page with no
// class declared none, and every element default drawn with `light-dark()` had no background and no colour there.
describe('the SDK base, of colour schemes', () => {
  it('declares a page with no class light, before the classes and the media query that say otherwise', () => {
    const root = css.search(/:root \{\s*color-scheme: light;/);
    const dark = css.search(/\.dark \{\s*color-scheme: dark;/);
    const media = css.search(/:root:not\(\.light\) \{\s*color-scheme: dark;/);

    expect(root).toBeGreaterThanOrEqual(0);
    expect(root).toBeLessThan(dark);
    expect(root).toBeLessThan(media);
  });
});
