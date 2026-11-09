/**
 * Every credential this server mints is a JWT built from REGISTERED claims (RFC 7519) plus `scope` (RFC 6749). There
 * are no bespoke `typ`/`data`/`version` claims: anyone who has read a JWT before can read one of these.
 *
 *   iss    which deployment minted it — the environment boundary
 *   sub    who or what it is about: a user id, or a space id
 *   aud    the API audiences it is meant for
 *   scope  what it is and what it may do (below)
 *   exp / iat / nbf / jti   lifetime and identity, as usual
 *
 * The one custom claim is `origins`, because JWT registers nothing for "the web origins this credential may be
 * presented from" — it is what binds a public render token to its domains.
 */
export const SCOPES = {
  user: 'user',
  refresh: 'refresh',
  widget: 'widget',
  spaceRender: 'space:render',
  spaceAgent: 'space:agent',
  /**
   * A SERVER that renders this space as its own — self-hosting. Secret by construction, which is the whole reason it
   * exists apart from `space:render`: see {@link SpaceScope}.
   */
  spaceHost: 'space:host',
  /** A sign-in that got the password right and still owes a second factor. Carries no authority of its own. */
  mfa: 'mfa'
} as const;

export type TokenScope = (typeof SCOPES)[keyof typeof SCOPES];

/**
 * What a space credential IS, and the distinction the other two are defined against.
 *
 * `render` is **public**: it ships in the clear inside every published page, so anybody who views source has it. The
 * only thing that keeps a copied one from working is that a browser is made to state where it is presenting from and
 * that statement is checked — a control that exists solely because browsers enforce it, and that means nothing to a
 * client which simply does not send the header.
 *
 * `host` is that same read access for a server, and it is **secret**: shown once when it is issued, never embedded in
 * a page, held only by the deployment operator. Self-hosting needs a credential that survives having no Origin to
 * check, and a public one cannot be it — a render key lifted from someone else's page would otherwise be enough to
 * serve a byte-identical clone of their site from anywhere.
 *
 * `agent` writes, on behalf of the member who consented.
 */
export type SpaceScope = 'render' | 'agent' | 'host';

/** The scopes that are safe to present with no `Origin` header, because they are not public to begin with. */
export const OFF_BROWSER_SPACE_SCOPES: readonly SpaceScope[] = ['agent', 'host'];

/** Why a credential was refused. A reason rather than a status, because each transport maps it onto its own. */
export type AuthFailure =
  | 'missing'
  | 'malformed'
  | 'expired'
  | 'outdated'
  | 'revoked'
  | 'wrong-type'
  | 'scope-mismatch'
  | 'issuer-not-allowed'
  | 'origin-not-allowed'
  | 'domain-not-allowed'
  | 'inactive'
  /**
   * The password was right and the address has never answered. Separate from `inactive` because it is the one
   * refusal whose owner can clear it themselves, and a screen that cannot tell them apart has to guess.
   */
  | 'unverified'
  /** The password was right, and the account's organization signs it in through its own single sign-on instead. */
  | 'sso-required';

export const authFailureMessage: Record<AuthFailure, string> = {
  missing: 'Authentication required',
  malformed: 'Token Invalid',
  expired: 'Token expired',
  outdated: 'Token outdated',
  revoked: 'Token Invalid',
  'wrong-type': 'Token Invalid',
  'scope-mismatch': 'Token Invalid',
  // In practice this is an environment mismatch — each deployment issues under its own `iss` — so the message says
  // so rather than leaving an hour to be lost to a generic refusal.
  'issuer-not-allowed': 'Token was issued by another environment',
  'origin-not-allowed': 'Access Not Authorized',
  'domain-not-allowed': 'This token is not allowed on this domain',
  inactive: 'Account is not active',
  unverified: 'Account is not verified',
  'sso-required': 'Sign in with your organization’s single sign-on'
};
