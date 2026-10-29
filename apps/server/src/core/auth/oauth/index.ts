import { buildAuthorizationUrl, exchangeCodeForToken } from './client';
import { createGitHubProvider } from './providers/github';
import { createGoogleProvider } from './providers/google';
import { codeChallenge, consumeFlow, startFlow } from './state';
import { OAuthFailure } from './types';
import { createRedirectPolicy } from '../redirects';

import type { OAuthFailureReason, OAuthProfile, OAuthProvider, OAuthProviderConfig } from './types';
import type { AccountRecord } from '../api';

export { OAuthFailure } from './types';
export { requestProfileJson } from './client';
export { createOidcProvider, discoverOidc } from './providers/oidc';
export type { OidcDiscovery, OidcProviderOptions } from './providers/oidc';
export type { OAuthFailureReason, OAuthProfile, OAuthProvider, OAuthProviderConfig, OAuthTokens } from './types';

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
  /**
   * A provider known only at run time — an organization's own sign-in (single sign-on), configured by its
   * administrators rather than by the deployment: asked for an id the configured providers do not have, with the
   * callback address that id is reached at. `createOidcProvider` makes one from an issuer, a client and a secret.
   */
  resolveProvider?: (id: string, redirectUri: string) => Promise<OAuthProvider | undefined>;
  /** Which run-time provider signs in `email`, by its domain, if any: what single sign-on starts from (`sso`). */
  providerForEmail?: (email: string) => Promise<string | undefined>;
}

/** A provider a sign-in screen can send somebody to: its name and the address that starts it. */
export interface ListedProvider {
  id: string;
  label: string;
  url: string;
}

export type StartedFlow = { redirectTo: string; stateCookie: string; ttl: number };

export type CompletedFlow =
  | { ok: true; redirectTo: string; account: AccountRecord }
  | { ok: false; redirectTo?: string; error: string; reason: OAuthFailureReason; detail?: string };

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
  // it is checked — by the one policy every flow that takes a `?redirect=` shares.
  const sanitizeRedirect = createRedirectPolicy({
    defaultRedirect: config.defaultRedirect,
    allowedRedirects: config.allowedRedirects
  });

  const withError = (target: string, reason: OAuthFailureReason, detail?: string): string =>
    `${target}${target.includes('?') ? '&' : '?'}error=${encodeURIComponent(reason)}${
      detail ? `&detail=${encodeURIComponent(detail)}` : ''
    }`;

  const loginBase = config.loginBaseUrl ?? config.callbackBaseUrl ?? '';
  const listed = (provider: OAuthProvider): ListedProvider => ({
    id: provider.id,
    label: provider.label,
    url: `${loginBase}/auth/${provider.id}/login`
  });

  /** A configured provider, or one the deployment resolves at run time; never a run-time one under a configured id. */
  const lookup = async (id: string): Promise<OAuthProvider | undefined> =>
    registry.get(id) ?? (await adapters.resolveProvider?.(id, `${config.callbackBaseUrl ?? ''}/auth/${id}/callback`));

  return {
    /**
     * Vet a caller-supplied landing page against this deployment's policy, for the flows that are not this one.
     *
     * Exposed because social sign-in is no longer the only thing that takes a `?redirect=` and then navigates to
     * it: the shared sign-in screen does too, and the check has to be the SAME check. Two implementations of "is
     * this target ours" is how one of them ends up accepting `//evil.com`.
     */
    sanitizeRedirect,

    /** Registered providers, so a front-end renders exactly the buttons that will work. */
    list: (): ListedProvider[] => [...registry.values()].map(listed),

    /** A configured provider. Run-time ones are not here: they sign in through the flow, never a token handed over. */
    get: (id: string): OAuthProvider | undefined => registry.get(id),

    /**
     * The single sign-on that signs in `email`, if its domain has one — or why there is none. Asked by a sign-in
     * screen before it sends anybody anywhere, so an address with no sign-on of its own hears so instead of a 404.
     */
    sso: async (email: string): Promise<{ provider: ListedProvider } | { error: string }> => {
      const address = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
        return { error: 'An email address is required' };
      }

      const id = await adapters.providerForEmail?.(address);
      const provider = id ? await lookup(id) : undefined;

      return provider
        ? { provider: listed(provider) }
        : { error: `${address.split('@')[1] ?? address} has no single sign-on here: sign in another way` };
    },

    start: async (providerId: string, redirect: unknown): Promise<StartedFlow | undefined> => {
      const provider = await lookup(providerId);
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
      const provider = await lookup(providerId);
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
        const tokens = await exchangeCodeForToken(provider, params.code, flow);
        const profile = await provider.fetchProfile(tokens);
        // The flow's job ends at "this is who came back". Minting the session is the caller's, which keeps this
        // free of the API that mints it.
        const account = await adapters.linkAccount(provider.id, profile);

        return { ok: true, redirectTo: flow.redirect, account };
      } catch (error) {
        const reason: OAuthFailureReason = error instanceof OAuthFailure ? error.reason : 'server_error';
        const detail = error instanceof OAuthFailure ? error.detail : undefined;

        return {
          ok: false,
          redirectTo: withError(flow.redirect, reason, detail),
          error: error instanceof Error ? error.message : 'server_error',
          reason,
          ...(detail === undefined ? {} : { detail })
        };
      }
    }
  };
};

export type SocialAuth = ReturnType<typeof createSocialAuth>;
