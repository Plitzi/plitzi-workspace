import { renderErrorPage } from './consentPage';

import type { SSRResponseHelpers } from '@plitzi/sdk-shared';

/** The error codes RFC 6749 defines for the responses this server produces. */
export type OAuthErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'unauthorized_client'
  | 'unsupported_grant_type'
  | 'unsupported_response_type'
  | 'invalid_scope'
  | 'access_denied'
  | 'server_error';

// Tokens and metadata must never be cached: one is a credential, the other changes with the deployment's host.
export const sendJson = (res: SSRResponseHelpers, status: number, body: unknown): void => {
  res.setStatus(status);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
};

export const sendHtml = (res: SSRResponseHelpers, status: number, html: string): void => {
  res.setStatus(status);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(html);
};

export const sendErrorJson = (
  res: SSRResponseHelpers,
  status: number,
  error: OAuthErrorCode,
  description: string
): void => sendJson(res, status, { error, error_description: description });

/** Shown when the authorization request itself is unusable — an unknown client, a `redirect_uri` that is not
 *  registered. Redirecting those back would turn the endpoint into an open redirector. */
export const sendErrorPage = (res: SSRResponseHelpers, title: string, detail: string): void =>
  sendHtml(res, 400, renderErrorPage(title, detail));

/** The other half of RFC 6749 error handling: once the redirect target is known to be legitimate, failures go
 *  back to the client so the host can report them, carrying `state` so it can match the response to its request. */
export const redirectWithError = (
  res: SSRResponseHelpers,
  redirectUri: string,
  error: OAuthErrorCode,
  description: string,
  state?: string
): void => {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  url.searchParams.set('error_description', description);
  if (state !== undefined) {
    url.searchParams.set('state', state);
  }

  res.setStatus(302);
  res.setHeader('Location', url.toString());
  res.setHeader('Cache-Control', 'no-store');
  res.end();
};

export const redirectWithCode = (res: SSRResponseHelpers, redirectUri: string, code: string, state?: string): void => {
  const url = new URL(redirectUri);
  url.searchParams.set('code', code);
  if (state !== undefined) {
    url.searchParams.set('state', state);
  }

  res.setStatus(302);
  res.setHeader('Location', url.toString());
  res.setHeader('Cache-Control', 'no-store');
  res.end();
};
