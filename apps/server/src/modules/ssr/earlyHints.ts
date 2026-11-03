import { pageAssets } from '../../core/sdkAssets';

import type { SSRPageServerConfig, SSRResponseHelpers } from '@plitzi/sdk-shared';

/**
 * What every page this server renders loads, as `Link` values: the SDK's stylesheets — which hold the first paint — and
 * the SDK itself, unless the page carries no script. Only what is the same whatever the page turns out to be; the
 * space's own stylesheet and document are known once it is read.
 */
export const pageLinks = (config: Pick<SSRPageServerConfig, 'assetVersion' | 'ssrOnly'>): string[] => {
  const { cssPath, iconsCssPath, jsPath } = pageAssets(config.assetVersion);

  return [
    `<${cssPath}>; rel=preload; as=style`,
    `<${iconsCssPath}>; rel=preload; as=style`,
    // A module is fetched in CORS mode: a preload that did not say `crossorigin` would be a second request for it.
    ...(config.ssrOnly === true ? [] : [`<${jsPath}>; rel=preload; as=script; crossorigin`])
  ];
};

/**
 * Says what the page will load before it is rendered: a `103 Early Hints` where the connection can carry one, and the
 * same `Link` on the response, which is what a CDN in front (Cloudflare) keeps to answer the next request's hints
 * itself. The browser fetches them while the server is still reading the space and rendering it — the time a page that
 * is not in the cache costs, which on a small server is most of what the visitor waits.
 */
export const sendEarlyHints = (config: SSRPageServerConfig, res: SSRResponseHelpers): void => {
  if (config.earlyHints === false) {
    return;
  }

  const links = pageLinks(config);
  res.setHeader('Link', links.join(', '));
  res.earlyHints?.(links);
};
