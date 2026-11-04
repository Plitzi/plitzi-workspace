import { randomBytes } from 'node:crypto';

import type { SSRResponseHelpers, SSRServerConfig } from '@plitzi/sdk-shared';

/** Where a browser reports what the page's script policy would have refused (`cspReportStage`). */
export const CSP_REPORT_PATH = '/_plitzi/csp-report';

/**
 * The nonce of one render of a page: what its template writes on each of its own scripts (`nonce="…"`), and what its
 * script policy names. A nonce and not the scripts' hashes, because the page is made of modules: what a script imports
 * (`import()`, the SDK and every plugin) is trusted by `'strict-dynamic'` through the importing script's nonce, and a
 * hash passes nothing on to the modules it loads.
 *
 * Kept with the page while it is cached, and made anew each time it is rendered again: a cached page is sent many
 * times, compressed once, and its bytes cannot change per response. A script someone wrote into the page (a raw HTML
 * block) carries none — the nonce is not in the document until the page is rendered, and is never one they could know.
 */
export const newScriptNonce = (): string => randomBytes(16).toString('base64');

/**
 * The script policy of a page rendered with `nonce`: its own scripts, what they load (`'strict-dynamic'`), and no plugin
 * object nor `<base>` that would move where the page's scripts come from. `'unsafe-inline'` and `https:` are there for a
 * browser that knows neither nonces nor `'strict-dynamic'`, and one that does ignores both.
 */
export const scriptPolicyOf = (nonce: string): string =>
  [
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:`,
    "object-src 'none'",
    "base-uri 'none'",
    `report-uri ${CSP_REPORT_PATH}`
  ].join('; ');

/** The page's script policy on its response, as reports only (`SSRServerConfig.scriptPolicy`); none without a nonce. */
export const sendScriptPolicy = (
  res: Pick<SSRResponseHelpers, 'setHeader'>,
  config: Pick<SSRServerConfig, 'scriptPolicy'>,
  nonce: string
): void => {
  if ((config.scriptPolicy ?? 'report-only') === 'report-only' && nonce) {
    res.setHeader('Content-Security-Policy-Report-Only', scriptPolicyOf(nonce));
  }
};
