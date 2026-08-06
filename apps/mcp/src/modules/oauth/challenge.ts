import { resourceMetadataUrl, scopesOf } from './metadata';
import { sendJson } from './respond';

import type { OAuthConfig, SSRRequest, SSRResponseHelpers } from '@plitzi/sdk-shared';

/** The credential on an MCP request. `Authorization: Bearer` is what RFC 6750 defines and what a remote host
 *  sends; `x-access-token` is the platform's own header, which the builder and the CLI already use — a request
 *  carrying either presents a credential, and the same verification decides whether it is a good one. */
export const bearerOf = (req: SSRRequest): string => {
  const header = req.headers['x-access-token'] ?? req.headers.authorization ?? '';
  const value = Array.isArray(header) ? (header[0] ?? '') : header;

  return value.replace(/^Bearer\s+/i, '').trim();
};

// A challenge parameter is a quoted string, so a quote inside a value would end it early. Nothing here is
// user-supplied today (the issuer and scopes are config), but a header that can be split is not worth the risk.
const parameter = (name: string, value: string): string => `${name}="${value.replace(/"/gu, '')}"`;

/** RFC 6750 §3 — the answer to an MCP request that presents no usable credential, and the only thing that starts
 *  an authorization flow: a host runs OAuth off a 401 whose `WWW-Authenticate` names the resource metadata, and
 *  IGNORES the header on a 200. Answering such a request with the anonymous surface instead is what leaves a
 *  connector unable to attach the grant it just completed — the flow succeeds and the host still reports that
 *  authorization failed. `scope` states what to ask for, so consent is not widened to everything advertised. */
export const sendChallenge = (
  config: OAuthConfig,
  req: SSRRequest,
  res: SSRResponseHelpers,
  description: string
): void => {
  const params = [
    parameter('error', 'invalid_token'),
    parameter('error_description', description),
    parameter('resource_metadata', resourceMetadataUrl(config, req)),
    parameter('scope', scopesOf(config).join(' '))
  ];

  res.setHeader('WWW-Authenticate', `Bearer ${params.join(', ')}`);
  // The challenge is useless to a browser-based host unless it may both receive and READ it: a cross-origin fetch
  // sees no response at all without the allow-origin, and `WWW-Authenticate` is not one of the headers exposed to
  // script by default — the MCP endpoint's own answers set the first of these, and this one never reaches it.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate');
  sendJson(res, 401, { error: 'invalid_token', error_description: description });
};
