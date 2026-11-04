import { randomBytes } from 'node:crypto';

import { TRUSTED_TYPES_POLICIES } from '@plitzi/sdk-shared/security';

import { frameAncestorsOf } from '../../core/http/securityHeaders';

import type { SSRResponseHelpers, SSRServerConfig, SSRSpaceDeployment } from '@plitzi/sdk-shared';

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

/** The page's script policy on a host: the deployment's for its domain, else the server's — none for `off`. */
export const scriptPolicyMode = (
  config: Pick<SSRServerConfig, 'scriptPolicy'>,
  deployment: SSRSpaceDeployment | undefined
): 'report-only' | 'enforce' | undefined => {
  const chosen = deployment?.security?.scriptPolicy ?? config.scriptPolicy ?? 'report-only';

  return chosen === 'off' || chosen === false ? undefined : chosen;
};

/**
 * What a page rendered with `nonce` is held to: its own scripts, what they load (`'strict-dynamic'`), and no plugin
 * object nor `<base>` that would move where the page's scripts come from. `'unsafe-inline'` and `https:` are there for
 * a browser that knows neither nonces nor `'strict-dynamic'`, and one that does ignores both.
 */
const scriptDirectives = (nonce: string): string[] => [
  `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:`,
  "object-src 'none'",
  "base-uri 'none'"
];

/** Markup written into the page only through the SDK's named policies (`TRUSTED_TYPES_POLICIES`). */
const trustedTypesDirectives = (): string[] => [
  "require-trusted-types-for 'script'",
  `trusted-types ${TRUSTED_TYPES_POLICIES.join(' ')} 'allow-duplicates'`
];

const REPORT_TO = `report-uri ${CSP_REPORT_PATH}`;

/**
 * A page's policies, as the two headers carry them: what is enforced — the script policy when it is, beside who may
 * frame the page (`frameAncestors`, the one header carrying both, since a second would only narrow the first) — and
 * what is only reported: the script policy while it is reported, and Trusted Types (`trustedTypes`) until it is
 * enforced too.
 */
export const pagePolicies = ({
  nonce,
  mode,
  trustedTypes,
  frameAncestors
}: {
  nonce: string;
  mode: 'report-only' | 'enforce' | undefined;
  trustedTypes: boolean;
  frameAncestors: string | undefined;
}): { enforced?: string; reportOnly?: string } => {
  const enforced = [
    ...(frameAncestors ? [frameAncestors] : []),
    ...(mode === 'enforce' && nonce ? [...scriptDirectives(nonce), REPORT_TO] : [])
  ];
  const reported = [
    ...(mode === 'report-only' && nonce ? scriptDirectives(nonce) : []),
    ...(mode && trustedTypes ? trustedTypesDirectives() : [])
  ];

  return {
    ...(enforced.length > 0 ? { enforced: enforced.join('; ') } : {}),
    ...(reported.length > 0 ? { reportOnly: [...reported, REPORT_TO].join('; ') } : {})
  };
};

/** The page's policies on its response (`pagePolicies`), for the host it was asked on; none without a nonce. */
export const sendScriptPolicy = (
  res: Pick<SSRResponseHelpers, 'setHeader'>,
  config: Pick<SSRServerConfig, 'scriptPolicy' | 'trustedTypes' | 'frameOptions'>,
  nonce: string,
  deployment: SSRSpaceDeployment | undefined
): void => {
  const { enforced, reportOnly } = pagePolicies({
    nonce,
    mode: scriptPolicyMode(config, deployment),
    trustedTypes: config.trustedTypes !== false,
    frameAncestors: frameAncestorsOf(config, deployment)
  });
  if (enforced) {
    res.setHeader('Content-Security-Policy', enforced);
  }

  if (reportOnly) {
    res.setHeader('Content-Security-Policy-Report-Only', reportOnly);
  }
};
