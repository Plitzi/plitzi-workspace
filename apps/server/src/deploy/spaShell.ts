import { digestOf, fingerprintOf } from './fingerprint';
import { buildVersions, sdkFiles } from './sdkFiles';
import { escapeHtml } from '../helpers/escapeHtml';
import { escapeJson } from '../helpers/escapeJson';

import type { BuiltSite, FingerprintParts, SiteFile } from './types';
import type { Environment, FontHead } from '@plitzi/sdk-shared';

/**
 * A space as a single-page app (RFC 0034 §5 "SPA"): an `index.html` that loads the SDK from beside it and asks the page
 * server for the space, and the SDK's files under a folder named by their digest. Hosted anywhere that serves files.
 *
 * The shell names the environment it serves and never a revision: the page server answers the revision the site's own
 * domain is published at (`renderGrant`'s `served`), so publishing to an SPA target is a pointer move, as it is on
 * Plitzi, and a deploy is needed only when the shell itself changed — its fingerprint says which part did.
 */

/** Changed when the shell's markup changes: every SPA built before needs a deploy to get it. */
const SHELL_VERSION = '1';

/** Where the SDK asks the platform, as the space's page server and APIs answer: the SDK's `server` setting. */
export interface SpaServers {
  /** The page server that answers `/_plitzi/space.json` with the space's public key. */
  ssrServer: string;
  apiServer: string;
  serverUrl: string;
  websocketServer: string;
  subscriptionServer: string;
}

export interface SpaShellInput {
  /** The space's public `render` key, whose origins name the site's domain. */
  webKey: string;
  environment: Exclude<Environment, 'main'>;
  servers: SpaServers;
  /** What the document's head says before the SDK takes over. */
  head: {
    title: string;
    /** BCP 47. */
    lang: string;
    /** An address or a `data:` URL. */
    favicon: string;
    fonts: FontHead;
  };
  /** The path the site is served under — `/` on its own domain, `/repo/` on a GitHub Pages project site. */
  basePath?: string;
}

const normalizeBase = (basePath: string | undefined): string => {
  const trimmed = (basePath ?? '/').trim().replace(/^\/*/, '/').replace(/\/*$/, '/');

  return trimmed === '//' ? '/' : trimmed;
};

const fontsMarkup = ({ preconnect, links, faces }: FontHead): string =>
  [
    ...preconnect.map(
      ({ href, crossorigin }) =>
        `<link rel="preconnect" href="${escapeHtml(href)}"${crossorigin ? ' crossorigin' : ''}>`
    ),
    ...links.map(
      ({ href, rel, as, type, crossorigin }) =>
        `<link rel="${rel}" href="${escapeHtml(href)}"${as ? ` as="${as}"` : ''}${type ? ` type="${escapeHtml(type)}"` : ''}${crossorigin ? ' crossorigin' : ''}>`
    ),
    ...(faces ? [`<style data-plitzi-fonts>${faces.replace(/<\//g, '<\\/')}</style>`] : [])
  ].join('\n    ');

/** The shell's `index.html`. */
const shellHtml = (input: SpaShellInput, base: string, sdkFolder: string): string => {
  const sdk = `${base}${sdkFolder}`;
  const imports = {
    react: `${sdk}/plitzi-sdk-vendor.js`,
    'react-dom': `${sdk}/plitzi-sdk-vendor.js`,
    'react-dom/client': `${sdk}/plitzi-sdk-vendor.js`,
    'react/jsx-runtime': `${sdk}/plitzi-sdk-vendor.js`,
    'react/compiler-runtime': `${sdk}/plitzi-sdk-vendor.js`,
    '@plitzi/plitzi-sdk': `${sdk}/plitzi-sdk.js`
  };
  const props = {
    webKey: input.webKey,
    environment: input.environment,
    renderMode: 'raw',
    server: { ...input.servers, basePath: base },
    state: {}
  };

  return `<!doctype html>
<html lang="${escapeHtml(input.head.lang)}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(input.head.title)}</title>
    <link rel="icon" href="${escapeHtml(input.head.favicon)}">
    <link rel="preconnect" href="${escapeHtml(input.servers.ssrServer)}" crossorigin>
    ${fontsMarkup(input.head.fonts)}
    <script type="importmap">${escapeJson(JSON.stringify({ imports }))}</script>
    <link rel="modulepreload" href="${escapeHtml(imports.react)}">
    <link rel="modulepreload" href="${escapeHtml(imports['@plitzi/plitzi-sdk'])}">
    <link rel="stylesheet" href="${escapeHtml(sdk)}/plitzi-sdk.css">
    <link rel="stylesheet" href="${escapeHtml(sdk)}/plitzi-sdk-icons.css">
  </head>
  <body>
    <noscript>This site needs JavaScript to show its pages.</noscript>
    <div id="plitzi" class="plitzi-root-container"></div>
    <script type="module">
      import { render } from '@plitzi/plitzi-sdk';

      render('plitzi', ${escapeJson(JSON.stringify(props))}, {}, false);
    </script>
  </body>
</html>
`;
};

/** What an SPA bakes in, part by part (§5.1): what its fingerprint is made of, and the reasons a deploy is needed. */
export const spaFingerprintParts = (input: SpaShellInput, sdkDigest = sdkFiles().digest): FingerprintParts => ({
  shell: SHELL_VERSION,
  sdk: sdkDigest,
  environment: input.environment,
  fonts: digestOf(input.head.fonts),
  head: digestOf({ title: input.head.title, lang: input.head.lang, favicon: input.head.favicon }),
  key: digestOf(input.webKey),
  servers: digestOf({ ...input.servers, basePath: normalizeBase(input.basePath) })
});

/**
 * The SPA, built: `index.html`, the same page as `404.html` — a static host answers an address it has no file for with
 * it, so a link into the site opens its page instead of the host's error — and the SDK's files.
 */
export const buildSpaShell = (input: SpaShellInput): BuiltSite => {
  const sdk = sdkFiles();
  const html = new TextEncoder().encode(shellHtml(input, normalizeBase(input.basePath), sdk.folder));
  const page = (path: string): SiteFile => ({
    path,
    body: html,
    type: 'text/html; charset=utf-8',
    cache: 'revalidate'
  });

  return {
    files: [page('index.html'), page('404.html'), ...sdk.files],
    fingerprint: fingerprintOf(spaFingerprintParts(input, sdk.digest)),
    versions: buildVersions()
  };
};
