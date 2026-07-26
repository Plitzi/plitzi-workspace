import { scopesOf } from './metadata';
import { field, optionalField } from './params';
import { randomId, verifyChallenge } from './pkce';
import { dropCode, dropRefresh, getCode, getRefresh, putAccess, putRefresh } from './records';
import { sendErrorJson, sendJson } from './respond';

import type { OAuthParams } from './params';
import type { RefreshRecord } from './records';
import type { OAuthConfig, SSRResponseHelpers } from '@plitzi/sdk-shared';

const DEFAULT_REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30;

// How long a bearer stays verifiable when the consumer states no lifetime for it. The record IS the expiry in
// that case, and reaching it costs the client nothing worse than one 401 it answers by refreshing.
const DEFAULT_ACCESS_TTL_SECONDS = 60 * 60 * 24 * 30;

const refreshTtlOf = (config: OAuthConfig): number => config.refreshTtlSeconds ?? DEFAULT_REFRESH_TTL_SECONDS;

const scopeOf = (config: OAuthConfig, requested?: string): string => requested ?? scopesOf(config).join(' ');

/** The token response, plus a rotated refresh grant when refresh is enabled. Rotation is unconditional: a refresh
 *  token is a long-lived credential, so the one just used never stays valid. */
const sendTokens = async (
  config: OAuthConfig,
  res: SSRResponseHelpers,
  credential: string,
  expiresInSeconds: number | undefined,
  grant: RefreshRecord
): Promise<void> => {
  const ttl = refreshTtlOf(config);
  // What the client gets is a handle to the grant, not the credential behind it: the consumer's own token is
  // usually good against more of the platform than this endpoint, and it stays on this side of the boundary.
  // Recording it is also what lets the resource side recognise the bearer at all and challenge everything else.
  // The TTL is never zero — a store cannot hold an entry for no time, and a bearer at its expiry must be refused.
  const bearer = randomId();
  await putAccess(
    config.adapters.store,
    bearer,
    { credential, clientId: grant.clientId, user: grant.user, target: grant.target },
    Math.max(expiresInSeconds ?? DEFAULT_ACCESS_TTL_SECONDS, 1)
  );

  const body: Record<string, unknown> = {
    access_token: bearer,
    token_type: 'Bearer',
    scope: scopeOf(config, grant.scope)
  };

  if (expiresInSeconds !== undefined) {
    body['expires_in'] = expiresInSeconds;
  }

  if (ttl > 0) {
    const refreshToken = randomId();
    await putRefresh(config.adapters.store, refreshToken, grant, ttl);
    body['refresh_token'] = refreshToken;
  }

  sendJson(res, 200, body);
};

const exchangeCode = async (config: OAuthConfig, res: SSRResponseHelpers, params: OAuthParams): Promise<void> => {
  const code = field(params, 'code');
  const record = code ? await getCode(config.adapters.store, code) : undefined;
  if (!record) {
    sendErrorJson(res, 400, 'invalid_grant', 'The authorization code is unknown or has expired.');

    return;
  }

  // Consumed whatever happens next: a code that failed verification must not stay redeemable either.
  await dropCode(config.adapters.store, code);

  if (record.clientId !== field(params, 'client_id')) {
    sendErrorJson(res, 400, 'invalid_grant', 'The authorization code was issued to another client.');

    return;
  }

  const redirectUri = optionalField(params, 'redirect_uri');
  if (redirectUri !== undefined && redirectUri !== record.redirectUri) {
    sendErrorJson(res, 400, 'invalid_grant', 'redirect_uri does not match the authorization request.');

    return;
  }

  if (!verifyChallenge(field(params, 'code_verifier'), record.challenge)) {
    sendErrorJson(res, 400, 'invalid_grant', 'The PKCE code verifier does not match the challenge.');

    return;
  }

  await sendTokens(config, res, record.token, record.expiresInSeconds, {
    clientId: record.clientId,
    scope: record.scope,
    user: record.user,
    target: record.target
  });
};

const exchangeRefresh = async (config: OAuthConfig, res: SSRResponseHelpers, params: OAuthParams): Promise<void> => {
  if (refreshTtlOf(config) === 0) {
    sendErrorJson(res, 400, 'unsupported_grant_type', 'This server issues no refresh tokens.');

    return;
  }

  const refreshToken = field(params, 'refresh_token');
  const record = refreshToken ? await getRefresh(config.adapters.store, refreshToken) : undefined;
  if (!record) {
    sendErrorJson(res, 400, 'invalid_grant', 'The refresh token is unknown or has expired.');

    return;
  }

  await dropRefresh(config.adapters.store, refreshToken);

  if (record.clientId !== field(params, 'client_id')) {
    sendErrorJson(res, 400, 'invalid_grant', 'The refresh token was issued to another client.');

    return;
  }

  const issued = await config.adapters.issueToken(record.user, record.target);
  if (!issued) {
    sendErrorJson(res, 400, 'invalid_grant', 'The account no longer has access to this resource.');

    return;
  }

  await sendTokens(config, res, issued.token, issued.expiresInSeconds, record);
};

/** POST /token. Public clients only, so there is no client authentication to check — PKCE is what proves the
 *  caller is the one that started the flow. */
export const handleToken = async (config: OAuthConfig, res: SSRResponseHelpers, params: OAuthParams): Promise<void> => {
  switch (field(params, 'grant_type')) {
    case 'authorization_code':
      await exchangeCode(config, res, params);

      return;
    case 'refresh_token':
      await exchangeRefresh(config, res, params);

      return;
    default:
      sendErrorJson(res, 400, 'unsupported_grant_type', 'Supported grants: authorization_code, refresh_token.');
  }
};
