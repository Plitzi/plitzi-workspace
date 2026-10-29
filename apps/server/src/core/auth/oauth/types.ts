export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * The identity a provider reports back. `emailVerified` is what makes linking safe: an incoming account may only be
 * matched onto an existing one by an address the provider itself checked.
 */
/**
 * What the token endpoint answered. `idToken` is OpenID Connect's — a signed statement of who signed in — and `nonce` is
 * the value this flow sent with the authorization request, which an ID token must carry back to be this flow's.
 */
export interface OAuthTokens {
  accessToken: string;
  idToken?: string;
  nonce: string;
}

export interface OAuthProfile {
  id: string;
  email: string;
  emailVerified: boolean;
  username: string;
}

/**
 * What every social provider declares. Everything shared by the authorization-code grant — the redirect, the CSRF
 * nonce, PKCE, the token exchange, issuing the session — is the flow's; an adapter only names this provider's
 * endpoints and maps its user payload onto {@link OAuthProfile}.
 */
export interface OAuthProvider {
  /** Route segment (`/auth/<id>`) and the value stored against the linked identity. Never change it once users exist. */
  id: string;
  label: string;
  config: OAuthProviderConfig;
  authorizationUrl: string;
  tokenUrl: string;
  scope: string;
  /** PKCE is only sent to providers that implement RFC 7636; GitHub OAuth apps ignore the challenge. */
  usePkce: boolean;
  /** Provider-specific extras for the authorization request (Google's `prompt`, for instance). */
  authorizationParams?: Record<string, string>;
  /** Extra headers on the token request. GitHub returns form-encoded bodies unless asked for JSON. */
  tokenHeaders?: Record<string, string>;
  /** OpenID Connect: send the flow's `nonce` with the authorization request, for the ID token to carry back. */
  sendsNonce?: boolean;
  fetchProfile: (tokens: OAuthTokens) => Promise<OAuthProfile>;
  /**
   * Proves a token was issued **for this application**, and not merely that it is a valid token belonging to
   * somebody. Only the credential exchange needs it, where the token arrives from a browser rather than from a code
   * this server redeemed itself — without it, any other site the user signed into with the same provider could
   * present their token here and be issued a session as them. An adapter that cannot check leaves it undefined, and
   * the exchange refuses that provider outright.
   */
  verifyAudience?: (accessToken: string) => Promise<boolean>;
}

export type OAuthFailureReason =
  | 'access_denied'
  | 'invalid_state'
  | 'exchange_failed'
  | 'profile_failed'
  | 'email_unverified'
  | 'email_missing'
  | 'account_inactive'
  /**
   * The provider proved who this is, and the deployment does not let them in — an address outside what the provider
   * may vouch for, a place with no room. `OAuthFailure.detail` says which, in the deployment's own words.
   */
  | 'not_permitted'
  | 'server_error';

/** Carried all the way to the browser as `?error=<reason>` on the redirect target, so a front-end can tell "you
 *  cancelled" from "that account is disabled" without parsing prose. */
export class OAuthFailure extends Error {
  readonly reason: OAuthFailureReason;
  /** A short code of the deployment's, carried as `&detail=<code>` beside the reason, for a screen to say more by. */
  readonly detail?: string;

  constructor(reason: OAuthFailureReason, message: string, detail?: string) {
    super(message);
    this.name = 'OAuthFailure';
    this.reason = reason;
    if (detail !== undefined) {
      this.detail = detail;
    }
  }
}
