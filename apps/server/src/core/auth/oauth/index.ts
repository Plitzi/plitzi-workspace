import { buildAuthorizationUrl, exchangeCodeForToken } from './client';
import { createGitHubProvider } from './providers/github';
import { createGoogleProvider } from './providers/google';
import { codeChallenge, consumeFlow, startFlow } from './state';
import { OAuthFailure } from './types';

import type { OAuthFailureReason, OAuthProfile, OAuthProvider, OAuthProviderConfig } from './types';
import type { AccountRecord } from '../api';

export { OAuthFailure } from './types';
export { requestProfileJson } from './client';
export type { OAuthFailureReason, OAuthProfile, OAuthProvider, OAuthProviderConfig } from './types';

export type OAuthProviderFactory = (config: OAuthProviderConfig) => OAuthProvider;

/** The adapters shipped with the server. A deployment adds its credentials and gets the provider; nothing else. */
export const BUILT_IN_PROVIDERS: Partial<Record<string, OAuthProviderFactory>> = {
  google: createGoogleProvider,
  github: createGitHubProvider
};

export interface SocialAuthConfig {
  /** Signs the flow state the browser carries between the two legs. */
  secret: string;
  /** How long a started flow stays valid. Defaults to ten minutes — long enough to sign in, short enough to matter. */
  stateTtl?: number;
  /** Where the browser lands when the caller asked for nowhere in particular. */
  defaultRedirect: string;
  /** Extra origins a caller may name as its landing page. The default target's origin is always allowed. */
  allowedRedirects?: string[];
  /** `<base>/auth/<id>/callback` unless a provider's own config names one. */
  callbackBaseUrl?: string;
  loginBaseUrl?: string;
}

export interface SocialAuthAdapters {
  /**
   * Turn a provider profile into an account here, linking or creating as the deployment sees fit. Throwing an
   * {@link OAuthFailure} reports the reason to the browser; anything else is a server error.
   */
  linkAccount: (provider: string, profile: OAuthProfile) => Promise<AccountRecord>;
}

const originOf = (value: string): string | null => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

export type StartedFlow = { redirectTo: string; stateCookie: string; ttl: number };

export type CompletedFlow =
  | { ok: true; redirectTo: string; account: AccountRecord }
  | { ok: false; redirectTo?: string; error: string; reason: OAuthFailureReason };

/**
 * Social sign-in, as two functions and a list.
 *
 * The authorization-code grant is the same everywhere and none of it is anyone's product: the CSRF nonce, PKCE, the
 * vetted redirect, the token exchange, reading the profile. What differs per deployment is which providers it has
 * credentials for and what it does with the person who comes back — so those are the adapters, and everything else
 * is here, once.
 *
 * Neither function touches a response: `start` hands back where to send the browser and the state to store, and
 * `complete` hands back where to send it next and who came back. The binding mints the session and writes cookies.
 */
export const createSocialAuth = ({
  config,
  adapters,
  providers: configured,
  customProviders = {}
}: {
  config: SocialAuthConfig;
  adapters: SocialAuthAdapters;
  /** Credentials per provider id. One with no client id or secret is simply not registered. */
  providers: Record<string, Partial<OAuthProviderConfig> | undefined>;
  /** Adapters for providers the server does not ship, merged over the built-in ones and selected the same way. */
  customProviders?: Partial<Record<string, OAuthProviderFactory>>;
}) => {
  const stateTtl = config.stateTtl ?? 600;
  const registry = new Map<string, OAuthProvider>();

  for (const [id, credentials] of Object.entries(configured)) {
    const factory = customProviders[id] ?? BUILT_IN_PROVIDERS[id];
    if (!factory || !credentials?.clientId || !credentials.clientSecret) {
      continue;
    }

    registry.set(
      id,
      factory({
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        redirectUri: credentials.redirectUri || `${config.callbackBaseUrl ?? ''}/auth/${id}/callback`
      })
    );
  }

  // Where the browser is sent once the flow ends. The target is caller-supplied, so it is an open redirect unless
  // it is checked: relative paths are safe by construction, absolute URLs must match an allowed origin. Anything
  // else silently becomes the default.
  const sanitizeRedirect = (target: unknown): string => {
    const fallback = config.defaultRedirect;

    if (typeof target !== 'string' || target === '') {
      return fallback;
    }

    // Protocol-relative ('//evil.com') and backslash variants read as a path but navigate off-site.
    if (target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/\\')) {
      return target;
    }

    const origin = originOf(target);
    if (!origin) {
      return fallback;
    }

    const allowed = [fallback, ...(config.allowedRedirects ?? [])]
      .map(originOf)
      .filter((value): value is string => value !== null);

    return allowed.includes(origin) ? target : fallback;
  };

  const withError = (target: string, reason: OAuthFailureReason): string =>
    `${target}${target.includes('?') ? '&' : '?'}error=${encodeURIComponent(reason)}`;

  return {
    /** Registered providers, so a front-end renders exactly the buttons that will work. */
    list: () =>
      [...registry.values()].map(provider => ({
        id: provider.id,
        label: provider.label,
        url: `${config.loginBaseUrl ?? config.callbackBaseUrl ?? ''}/auth/${provider.id}/login`
      })),

    get: (id: string): OAuthProvider | undefined => registry.get(id),

    start: (providerId: string, redirect: unknown): StartedFlow | undefined => {
      const provider = registry.get(providerId);
      if (!provider) {
        return undefined;
      }

      const { state, cookie } = startFlow(provider.id, sanitizeRedirect(redirect), config.secret, stateTtl);

      return {
        redirectTo: buildAuthorizationUrl(provider, state, codeChallenge(state.verifier)),
        stateCookie: cookie,
        ttl: stateTtl
      };
    },

    complete: async (
      providerId: string,
      params: { code?: string; state?: string; error?: string; stateCookie?: string }
    ): Promise<CompletedFlow> => {
      const provider = registry.get(providerId);
      if (!provider) {
        return { ok: false, error: 'Unknown provider', reason: 'invalid_state' };
      }

      const flow = consumeFlow(params.stateCookie, provider.id, params.state, config.secret);

      // Without a valid flow there is no vetted redirect target to report to, so the failure has to end here.
      if (!flow) {
        return { ok: false, error: 'Invalid or expired authorization state', reason: 'invalid_state' };
      }

      if (params.error || !params.code) {
        const reason: OAuthFailureReason = params.error ? 'access_denied' : 'invalid_state';

        return { ok: false, redirectTo: withError(flow.redirect, reason), error: params.error ?? '', reason };
      }

      try {
        const accessToken = await exchangeCodeForToken(provider, params.code, flow);
        const profile = await provider.fetchProfile(accessToken);
        // The flow's job ends at "this is who came back". Minting the session is the caller's, which keeps this
        // free of the API that mints it.
        const account = await adapters.linkAccount(provider.id, profile);

        return { ok: true, redirectTo: flow.redirect, account };
      } catch (error) {
        const reason: OAuthFailureReason = error instanceof OAuthFailure ? error.reason : 'server_error';

        return {
          ok: false,
          redirectTo: withError(flow.redirect, reason),
          error: error instanceof Error ? error.message : 'server_error',
          reason
        };
      }
    }
  };
};

export type SocialAuth = ReturnType<typeof createSocialAuth>;
