import { OAuthFailure } from './types';

import type { OAuthFlowState } from './state';
import type { OAuthProvider } from './types';

export function buildAuthorizationUrl(provider: OAuthProvider, state: OAuthFlowState, challenge?: string): string {
  const params = new URLSearchParams({
    client_id: provider.config.clientId,
    redirect_uri: provider.config.redirectUri,
    response_type: 'code',
    scope: provider.scope,
    state: state.nonce,
    ...provider.authorizationParams
  });

  if (provider.usePkce && challenge) {
    params.set('code_challenge', challenge);
    params.set('code_challenge_method', 'S256');
  }

  return `${provider.authorizationUrl}?${params.toString()}`;
}

// The authorization-code grant is identical everywhere; only the headers differ (GitHub answers form-encoded unless
// asked for JSON). Providers that report failure with a 200 + `error` body are covered too.
export async function exchangeCodeForToken(
  provider: OAuthProvider,
  code: string,
  state: OAuthFlowState
): Promise<string> {
  const body = new URLSearchParams({
    code,
    client_id: provider.config.clientId,
    client_secret: provider.config.clientSecret,
    redirect_uri: provider.config.redirectUri,
    grant_type: 'authorization_code'
  });

  if (provider.usePkce) {
    body.set('code_verifier', state.verifier);
  }

  const response = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      ...provider.tokenHeaders
    },
    body
  });

  if (!response.ok) {
    throw new OAuthFailure('exchange_failed', `${provider.id} rejected the authorization code (${response.status})`);
  }

  const payload = (await response.json()) as { access_token?: string; error?: string };

  if (!payload.access_token) {
    throw new OAuthFailure(
      'exchange_failed',
      `${provider.id} returned no access token (${payload.error ?? 'unknown'})`
    );
  }

  return payload.access_token;
}

// Shared by the adapters' fetchProfile: any non-2xx from a provider's user API is a profile failure, never an
// exception that would surface to the browser as a 500.
export async function requestProfileJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new OAuthFailure('profile_failed', `Failed to read the profile from ${url} (${response.status})`);
  }

  return (await response.json()) as T;
}
