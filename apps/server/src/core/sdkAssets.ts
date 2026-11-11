import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

/** Where the rendered page is told to fetch the SDK bundle from. Emitted by the render, so it is also served. */
export const SDK_ASSETS_PREFIX = '/sdk-assets';

let resolvedSdkDir: { dir: string | undefined } | undefined;

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
// Once a process: where the SDK is installed cannot change while it runs, and resolving it is a module lookup — read on
// every render (the page's icon faces), it was a part of each render's CPU.
export const resolveSdkAssetsDir = (): string | undefined => {
  if (resolvedSdkDir) {
    return resolvedSdkDir.dir;
  }

  try {
    const require = createRequire(import.meta.url);
    resolvedSdkDir = { dir: path.dirname(require.resolve('@plitzi/plitzi-sdk/plitzi-sdk.css')) };
  } catch {
    resolvedSdkDir = { dir: undefined };
  }

  return resolvedSdkDir.dir;
};

/**
 * A cache-buster for the SDK URLs, taken from the bundle's own mtime.
 *
 * The assets are served with a long `Cache-Control`, so something has to change in the URL when the bundle does or
 * browsers keep the old one. Since the version a deployment runs IS the version of this package, the server can work
 * it out — nobody should have to compute it and pass it in, and forgetting to is a stale bundle nobody can explain.
 */
let cachedVersion: string | undefined;

const sdkAssetVersion = (): string => {
  // Read once: it cannot change while this process runs, and the alternative is a `statSync` on every page render.
  if (cachedVersion !== undefined) {
    return cachedVersion;
  }

  const dir = resolveSdkAssetsDir();

  try {
    cachedVersion = dir ? Math.floor(statSync(path.join(dir, 'plitzi-sdk.js')).mtimeMs).toString(36) : '';
  } catch {
    cachedVersion = '';
  }

  return cachedVersion;
};

/** The SDK's files a rendered page loads, at the version this server serves: one place for the page and its hints. */
export type PageAssets = {
  jsPath: string;
  cssPath: string;
  iconsCssPath: string;
  devToolsCssPath: string;
  /** React and its kin: the production build, and the development one a page drawing the dev tools loads instead. */
  vendorJsPath: string;
  devVendorJsPath: string;
};

export const pageAssets = (assetVersion: string | undefined): PageAssets => {
  // Falls back to the bundle's own mtime, so the cache-buster is right without anybody supplying one.
  const version = assetVersion ?? sdkAssetVersion();
  const v = version ? `?v=${version}` : '';

  return {
    jsPath: `${SDK_ASSETS_PREFIX}/plitzi-sdk.js${v}`,
    cssPath: `${SDK_ASSETS_PREFIX}/plitzi-sdk.css${v}`,
    iconsCssPath: `${SDK_ASSETS_PREFIX}/plitzi-sdk-icons.css${v}`,
    devToolsCssPath: `${SDK_ASSETS_PREFIX}/plitzi-sdk-devtools.css${v}`,
    vendorJsPath: `${SDK_ASSETS_PREFIX}/plitzi-sdk-vendor.js${v}`,
    devVendorJsPath: `${SDK_ASSETS_PREFIX}/plitzi-sdk-dev-vendor.js${v}`
  };
};
