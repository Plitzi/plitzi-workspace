export type User = {
  id: number;
  username: string;
  email: string;
  verified: boolean;
  permissions: string[];
  roles: string[];
};

export type TokenResult = {
  errors?: Record<string, unknown>;
  accessToken: string;
  /** Unix seconds. Seconds rather than milliseconds because that is what a JWT `exp` and every OAuth2 response use. */
  expiresAt: number | null;
  refreshToken: string | null;
  /** Unix seconds the refresh token dies at, when the backend says. Renewal is impossible past it. */
  refreshExpiresAt?: number | null;
};

export type AuthState = 'init' | 'initLoading' | 'authenticating' | 'authenticated' | 'guest';

/**
 * Why a credential was refused, as reported by the auth backend (Plitzi's API answers it in `reason` on every 401).
 * The distinction that matters to a client is renewable versus not: `expired` asks for a refresh, `revoked`,
 * `inactive` and `missing` end the session, and `network` is not an answer at all — it must never sign anyone out.
 *
 * `unverified` is the one that is not about the credential: the password was right and the address has never answered.
 * It is terminal like `inactive` — there is no session to be had — but it is the only refusal a person can do
 * something about, which is why it is worth telling them apart. A sign-in screen that cannot distinguish them says
 * "that email or password was not right" to somebody whose password was fine, and they try it again.
 */
export type AuthFailureReason =
  'missing' | 'expired' | 'revoked' | 'inactive' | 'unverified' | 'malformed' | 'outdated' | 'network';

/** What an auth backend hands back from a grant (login, refresh) or an identity call. Both halves are optional:
 *  a backend may answer a refresh with tokens alone, or an identity call with a user alone. */
export type AuthGrant<U = Record<string, unknown>> = { user?: U; token?: TokenResult };

export type AuthResult<U = Record<string, unknown>> =
  ({ ok: true } & AuthGrant<U>) | { ok: false; reason: AuthFailureReason };

/**
 * What a sign-in came to: the session it minted, or why there is none.
 *
 * A bare `TokenResult | undefined` was not enough to write a sign-in screen with. Absence is every refusal at once —
 * wrong password, unconfirmed address, blocked account, backend unreachable — so the only sentence a page could write
 * under it was the one that covers all four, and it is wrong for three of them.
 *
 * The success half spreads a {@link TokenResult}, so `accessToken` is read off the outcome itself and a flow written
 * against the old shape still finds it where it always was.
 */
export type LoginResult = ({ ok: true } & TokenResult) | { ok: false; reason: AuthFailureReason };

export type AuthContextValue = {
  /** The credentials your login endpoint expects. Values arrive from interaction parameters, hence `unknown`. */
  login: (params: Record<string, unknown>) => Promise<LoginResult>;
  refresh: (params?: Record<string, unknown>) => Promise<TokenResult | undefined>;
  can: (permission: string) => boolean;
  logout: () => Promise<void>;
  /** Ask the backend whether the session still stands, renewing it if that is what it takes. Resolves to the
   *  outcome, so a caller that needs certainty (a guarded action) can await it instead of trusting the last check. */
  revalidate: (force?: boolean) => Promise<boolean>;
  /** Report that the backend refused a credential — the `reason` from a 401. `expired` triggers a silent renewal,
   *  anything terminal ends the session. This is how an app tells auth that reality moved on between checks. */
  invalidate: (reason?: AuthFailureReason) => void;
  state: AuthState;
  authenticated: boolean;
  user?: {
    details?: {
      id: number;
      username: string;
      email: string;
      verified: boolean;
      permissions: string[];
      roles: string[];
    };
    accessToken?: string;
  };
};
