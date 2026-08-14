/** Authentication and authorization, whole. Import it as `@plitzi/sdk-server/auth`.
 *
 *  Everything a deployment needs to answer *who is this* and *may they* — the token kernel, the session cookies,
 *  the identity resolver, the RBAC checks, the `/auth` flows, the OAuth providers and the space-token lifecycle.
 *  `createAuth` assembles the lot in one call and is what almost every deployment wants; the pieces stay exported
 *  for the one that needs to build a half of it itself.
 *
 *  This used to live in `@plitzi/sdk-server/kernel`, next to the HTTP dispatcher. Two unrelated surfaces under one
 *  name that named neither of them: a deployment wiring up sessions had no reason to read about stages, and
 *  `@plitzi/sdk-mcp`, which wants the dispatcher and no auth at all, had to import from the same place. `/kernel`
 *  is now the HTTP kernel and nothing else.
 *
 *  ```ts
 *  import { createAuth } from '@plitzi/sdk-server/auth';
 *  import { createServer } from '@plitzi/sdk-server';
 *
 *  const auth = createAuth({ tokens: { secret, issuer }, adapters: myAccountStore });
 *  const server = createServer({ adapters: space, auth });
 *  ```
 *
 *  A deployment with no account store of its own can have one: `@plitzi/sdk-server/mysql` brings the tables and
 *  every adapter below already implemented. */

export { createAuth } from './core/auth/createAuth';
export { createAuthApi } from './core/auth/api';
export { createAuthorizer, checkPermission, checkSpaceAccess, requirementFor } from './core/auth/authorize';
export { createCarriers, presentedOrigin } from './core/auth/credentials';
export {
  ANY_DOMAIN,
  corsOrigins,
  domainAllowed,
  frameAncestors,
  hostnameOf,
  normalizeDomain
} from './core/auth/domains';
export { createIdentity } from './core/auth/identity';
export { BUILT_IN_PROVIDERS, OAuthFailure, createSocialAuth, requestProfileJson } from './core/auth/oauth';
export { applySessionOutcome, authPolicyRules, authRoutes } from './core/auth/routes';
export {
  clearFlowCookie,
  clearSessionCookies,
  createSessionCookies,
  isLocalHost,
  readFlowCookie,
  readRefreshToken,
  readSessionToken,
  sessionCookieParams,
  sessionHintValue,
  writeFlowCookie,
  writeSessionCookies
} from './core/auth/session';
export { createSpaceTokenApi } from './core/auth/spaceTokens';
export { SCOPES, authFailureMessage, createTokens, userIdOf } from './core/auth/tokens';
export {
  generateRecoveryCodes,
  generateTotpSecret,
  normalizeRecoveryCode,
  randomCode,
  totpCode,
  totpUri,
  verifyTotp
} from './core/auth/totp';

export type { Auth, AuthConfig } from './core/auth/createAuth';
export type {
  AccountAccess,
  AccountAdapters,
  AccountQuery,
  AccountRecord,
  AccountStatus,
  AuthApi,
  AuthApiConfig,
  AuthOutcome,
  ExchangeResult,
  MfaRecord,
  PasswordPolicy,
  SecurityEvent,
  SessionClient,
  SessionContext,
  SessionSummary,
  ThrottleAttempt,
  ThrottledAction
} from './core/auth/api';
export type {
  AuthPolicy,
  AuthorizeResult,
  Authorizer,
  MembershipFacts,
  PathMatcher,
  PermissionCheck,
  Requirement,
  SpaceAccessCheck
} from './core/auth/authorize';
export type { CredentialCarrier } from './core/auth/credentials';
export type {
  Actor,
  ActorResult,
  Grant,
  GrantOptions,
  GrantResult,
  Identity,
  IdentityAdapters,
  IdentityConfig,
  SpaceMembership,
  StoredSpaceToken
} from './core/auth/identity';
export type {
  CompletedFlow,
  OAuthFailureReason,
  OAuthProfile,
  OAuthProvider,
  OAuthProviderConfig,
  SocialAuth,
  SocialAuthAdapters,
  SocialAuthConfig,
  StartedFlow
} from './core/auth/oauth';
export type { AuthRequest, AuthRoute } from './core/auth/routes';
export type { CookieCarrier, CookieSink, SessionCookieParams, SessionCookies } from './core/auth/session';
export type {
  SpaceTokenAdapters,
  SpaceTokenApi,
  SpaceTokenContext,
  SpaceTokenOutcome,
  SpaceTokenRecord,
  SpaceTokenSummary
} from './core/auth/spaceTokens';
export type {
  AuthFailure,
  MfaChallengePayload,
  RefreshTokenPayload,
  SpaceScope,
  SpaceTokenOptions,
  SpaceTokenPayload,
  TokenConfig,
  TokenScope,
  Tokens,
  UserTokenPayload,
  VerifyResult,
  WidgetTokenPayload
} from './core/auth/tokens';
