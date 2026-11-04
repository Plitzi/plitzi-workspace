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
 * Says what the page will load: the same `Link` on every response, which is what a CDN in front (Cloudflare) keeps to
 * answer the next request's hints itself — and a `103 Early Hints` where the connection can carry one, sent by the
 * function this returns, called only when the page is to be rendered. The browser fetches the hinted files while the
 * server reads the space and renders it, which on a small server is most of what the visitor waits; a kept page is
 * answered in under a millisecond, and a 103 before it was one more write on the socket for every page served: the
 * bench served cached pages up to a quarter slower with it.
 */
export const pageHints = (config: SSRPageServerConfig, res: SSRResponseHelpers): (() => void) => {
  if (config.earlyHints === false) {
    return () => undefined;
  }

  const links = pageLinks(config);
  res.setHeader('Link', links.join(', '));
  let sent = false;

  return () => {
    if (!sent) {
      sent = true;
      res.earlyHints?.(links);
    }
  };
};
