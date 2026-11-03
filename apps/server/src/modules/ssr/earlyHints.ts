import { pageAssets } from '../../core/sdkAssets';

import type { SSRPageServerConfig, SSRResponseHelpers } from '@plitzi/sdk-shared';

/**
 * What every page this server renders paints with, as `Link` values: the SDK's stylesheets. Only what is the same
 * whatever the page turns out to be — the space's own stylesheet is known once it is read — and only what the first
 * paint waits for: the SDK itself is asked once the page has painted (the bootstrap, `views/template.ejs`), and a
 * hint for it would put it back on the line beside the stylesheets.
 */
export const pageLinks = (config: Pick<SSRPageServerConfig, 'assetVersion'>): string[] => {
  const { cssPath, iconsCssPath } = pageAssets(config.assetVersion);

  return [`<${cssPath}>; rel=preload; as=style`, `<${iconsCssPath}>; rel=preload; as=style`];
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
