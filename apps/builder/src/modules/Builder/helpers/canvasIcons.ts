import type { Asset } from '@plitzi/sdk-shared';

/**
 * The SDK's Font Awesome sheet in a canvas: linked, never inlined.
 *
 * The sheet names its fonts relative to itself (`webfonts/…`), so they are found wherever the sheet is served from.
 * Inlined into the canvas's `<style>` they resolved against the document instead — a `srcdoc` frame takes the editor's
 * URL as its base — and every icon was a 404 under `/spaces/<space>/webfonts/`. Only the Vite dev server, which
 * rewrites the URL, hid it.
 */
export const canvasIconsAssets = (href: string): Record<string, Asset> =>
  href ? { 'sdk-icons': { type: 'link', id: 'sdk-icons', params: { href, type: 'text/css', rel: 'stylesheet' } } } : {};
