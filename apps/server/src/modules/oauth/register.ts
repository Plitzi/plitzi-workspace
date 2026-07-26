import { randomId } from './pkce';
import { putClient } from './records';
import { sendErrorJson, sendJson } from './respond';

import type { OAuthConfig, SSRResponseHelpers } from '@plitzi/sdk-shared';

// A redirect target must be one the user's browser can be sent to safely. https anywhere, plain http only on the
// loopback interface — the exception RFC 8252 carves out for a client listening on a local port.
const isUsableRedirectUri = (value: string): boolean => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol === 'https:') {
    return true;
  }

  return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
};

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

/** RFC 7591 dynamic client registration. A remote host has no way to be configured into this server ahead of
 *  time, so it registers itself on first connect; the record it gets back is only ever used to pin the redirect
 *  target, since a public client authenticates with PKCE rather than with credentials. */
export const handleRegister = async (config: OAuthConfig, res: SSRResponseHelpers, body: unknown): Promise<void> => {
  if (typeof body !== 'object' || body === null) {
    sendErrorJson(res, 400, 'invalid_request', 'Expected a JSON client metadata object.');

    return;
  }

  const metadata = body as Record<string, unknown>;
  const redirectUris = stringList(metadata['redirect_uris']).filter(isUsableRedirectUri);
  if (redirectUris.length === 0) {
    sendErrorJson(res, 400, 'invalid_request', 'redirect_uris must list at least one https (or loopback) URI.');

    return;
  }

  const clientName = typeof metadata['client_name'] === 'string' ? metadata['client_name'] : 'MCP client';
  const clientId = randomId();

  await putClient(config.adapters.store, { clientId, clientName, redirectUris });

  sendJson(res, 201, {
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: clientName,
    redirect_uris: redirectUris,
    grant_types: config.refreshTtlSeconds === 0 ? ['authorization_code'] : ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none'
  });
};
