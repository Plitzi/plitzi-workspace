import { createRequire } from 'node:module';
import path from 'node:path';

/** Where the rendered page is told to fetch the SDK bundle from. Emitted by the render, so it is also served. */
export const SDK_ASSETS_PREFIX = '/sdk-assets';

/**
 * The SDK's built output, resolved through the module system rather than guessed from `process.cwd()`.
 *
 * The rendered page asks for `/sdk-assets/plitzi-sdk.js` — the server puts that URL there itself — so the server is
 * also what should answer it. It used to be a mount every deployment had to declare, and forgetting it produced no
 * error at all: the asset requests fell through to the page renderer, which answered each one with a 200 and an HTML
 * document. The browser then refused them for their MIME type and the page stayed blank. A missing line of config
 * that looks like a broken SDK is not a choice worth offering.
 *
 * Returns undefined if the SDK is not installed, which is legitimate: a server rendering `ssrOnly` pages, or one
 * whose deployment serves the bundle from a CDN, needs none of this.
 */
export const resolveSdkAssetsDir = (): string | undefined => {
  try {
    const require = createRequire(import.meta.url);

    return path.dirname(require.resolve('@plitzi/plitzi-sdk/plitzi-sdk.css'));
  } catch {
    return undefined;
  }
};
