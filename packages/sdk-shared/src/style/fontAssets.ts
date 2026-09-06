import type { Asset } from '../types/PluginTypes';
import type { FontHead } from '../types/StyleTypes';

/**
 * The manifest's stylesheets as the asset rail describes them, for the one surface that renders into a document of
 * its own: the builder canvas, and the SDK's own iframe render mode. Its `<head>` is reachable only through the rail, so what the SSR template writes and
 * what a client-only render appends to `document.head` has to arrive there as assets instead.
 *
 * Only the stylesheets. The preconnects and preloads are there to save a visitor a round trip on a cold cache, and
 * the canvas has neither — while `@font-face` blocks cannot ride a `<link>` at all, so they travel with the style
 * the frame already writes into a `<style>` of its own.
 */
export const fontLinkAssets = (head: FontHead): Record<string, Asset> =>
  head.links
    .filter(link => link.rel === 'stylesheet')
    .reduce<Record<string, Asset>>((assets, link, i) => {
      const id = `font-${i}`;

      return {
        ...assets,
        [id]: { type: 'link', id, params: { href: link.href, type: 'text/css', rel: 'stylesheet' } }
      };
    }, {});
