import { createHash } from 'node:crypto';

import { randomId } from './pkce';
import { getClientByFingerprint, putClient, putClientFingerprint } from './records';
import { sendErrorJson, sendJson } from './respond';

import type { OAuthConfig, SSRResponseHelpers } from '@plitzi/sdk-shared';

const parseUri = (value: string): URL | undefined => {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
};

/** Plain http on the loopback interface — the exception RFC 8252 carves out for a native app listening on a port. */
export const isLoopbackRedirectUri = (value: string): boolean => {
  const url = parseUri(value);

  return url?.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
};

/**
 * A redirect target must be one the user's browser can be sent to safely: https anywhere, or loopback. A deployment
 * whose clients are all native apps narrows that to loopback alone (see `OAuthConfig.loopbackRedirectsOnly`).
 */
const isUsableRedirectUri = (value: string, loopbackOnly: boolean): boolean =>
  isLoopbackRedirectUri(value) || (!loopbackOnly && parseUri(value)?.protocol === 'https:');

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

// What a client asked to be registered AS. Identical metadata resolves to one registration: RFC 7591 never requires
// a fresh id per call, and a host that registers on every connection (Claude's DCR does, twice per attempt — once
// per backend instance) would otherwise leave a new record behind each time. Worse, when two of its instances
// register in parallel they walk away with DIFFERENT ids for the same client, so whichever one later has to make
// sense of the grant may be holding an id the flow never used.
const fingerprintOf = (clientName: string, redirectUris: string[]): string =>
  createHash('sha256')
    .update(JSON.stringify([clientName, [...redirectUris].sort()]))
    .digest('base64url');

/**
 * What a client calls itself is shown to the person it acts for — on the grant screen and in their list of devices — so
 * it is bounded: a name is a line of text, not a document a client can fill the screen with.
 */
const CLIENT_NAME_MAX = 120;
const SOFTWARE_ID_MAX = 64;

const textField = (value: unknown, max: number): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim().slice(0, max);

  return trimmed || undefined;
};

/** RFC 7591 dynamic client registration. A remote host has no way to be configured into this server ahead of
 *  time, so it registers itself on first connect; the record it gets back is only ever used to pin the redirect
 *  target, since a public client authenticates with PKCE rather than with credentials. */
export const handleRegister = async (config: OAuthConfig, res: SSRResponseHelpers, body: unknown): Promise<void> => {
  if (typeof body !== 'object' || body === null) {
    sendErrorJson(res, 400, 'invalid_request', 'Expected a JSON client metadata object.');

    return;
  }

  const metadata = body as Record<string, unknown>;
  const loopbackOnly = config.loopbackRedirectsOnly === true;
  const redirectUris = stringList(metadata['redirect_uris']).filter(uri => isUsableRedirectUri(uri, loopbackOnly));
  if (redirectUris.length === 0) {
    sendErrorJson(
      res,
      400,
      'invalid_request',
      loopbackOnly
        ? 'redirect_uris must list at least one loopback URI (http://127.0.0.1:<port>/…).'
        : 'redirect_uris must list at least one https (or loopback) URI.'
    );

    return;
  }

  const clientName = textField(metadata['client_name'], CLIENT_NAME_MAX) ?? 'MCP client';
  const softwareId = textField(metadata['software_id'], SOFTWARE_ID_MAX);
  const { store } = config.adapters;
  const fingerprint = fingerprintOf(clientName, redirectUris);
  const existing = await getClientByFingerprint(store, fingerprint);
  const client = existing ?? {
    clientId: randomId(),
    clientName,
    ...(softwareId ? { softwareId } : {}),
    redirectUris,
    issuedAt: nowSeconds()
  };

  // Written on every call, existing or not, so an active client's record and its fingerprint keep their TTL rolling
  // rather than expiring under a host that has been connected all along.
  await putClient(store, client);
  await putClientFingerprint(store, fingerprint, client.clientId);

  sendJson(res, 201, {
    client_id: client.clientId,
    client_id_issued_at: client.issuedAt,
    client_name: clientName,
    ...(client.softwareId ? { software_id: client.softwareId } : {}),
    redirect_uris: redirectUris,
    grant_types: config.refreshTtlSeconds === 0 ? ['authorization_code'] : ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none'
  });
};
