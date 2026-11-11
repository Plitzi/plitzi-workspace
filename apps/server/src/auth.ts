/** Signing people in. Import it as `@plitzi/sdk-server/auth`.
 *
 *  The `/auth` flows, passwords and second factors, the OAuth providers, the space-token lifecycle's routes, and
 *  `createAuth`, which assembles them over the kernel's checks and is what almost every deployment wants.
 *
 *  Checking who a request is — the tokens (`@plitzi/sdk-kernel/tokens`), the session cookies, the identity resolver,
 *  CSRF, the RBAC checks (`@plitzi/sdk-kernel/identity`) — is the kernel's (docs/en/server-packages.md, D3): a worker checks credentials
 *  and signs nobody in, so it runs that half without this one.
 *
 *  ```ts
 *  import { createAuth } from '@plitzi/sdk-server/auth';
 *  import { createServer } from '@plitzi/sdk-server';
 *
 *  const auth = createAuth({ tokens: { keys, issuer }, secret, adapters: myAccountStore });
 *  const server = createServer({ adapters: space, auth });
 *  ```
 *
 *  A deployment with no account store of its own can have one: `@plitzi/sdk-kernel/mysql` brings the tables and
 *  every adapter below already implemented. */

export { createAuth } from './core/auth/createAuth';
export { createAuthApi } from './core/auth/api';
export {
  BUILT_IN_PROVIDERS,
  OAuthFailure,
  createOidcProvider,
  createSocialAuth,
  discoverOidc,
  requestProfileJson
} from './core/auth/oauth';
export { createRedirectPolicy } from './core/auth/redirects';
export { isDocumentNavigation, renewForNavigation } from './core/auth/renewal';
export type { RenewalOptions } from './core/auth/renewal';
export type { RedirectPolicyConfig } from './core/auth/redirects';
export { applySessionOutcome, authPolicyRules, authRoutes } from './core/auth/routes';
export { createRateLimit, memoryThrottleCounts, redisThrottleCounts } from './core/auth/throttle';
export type { ThrottleCounter, ThrottleCounts, ThrottleRedis, ThrottleVerdict } from './core/auth/throttle';
export {
  generateRecoveryCodes,
  generateTotpSecret,
  normalizeRecoveryCode,
  randomCode,
  totpCode,
  totpStep,
  totpUri,
  verifyTotp
} from './core/auth/totp';

export type { Auth, AuthConfig } from './core/auth/createAuth';
export type {
  AuthApi,
  AuthApiConfig,
  AuthOutcome,
  ExchangeResult,
  PasswordPolicy,
  ThrottleAttempt,
  ThrottledAction
} from './core/auth/api';
export type {
  CompletedFlow,
  ListedProvider,
  OAuthFailureReason,
  OAuthProfile,
  OAuthProvider,
  OAuthProviderConfig,
  OAuthTokens,
  OidcDiscovery,
  OidcProviderOptions,
  SocialAuth,
  SocialAuthAdapters,
  SocialAuthConfig,
  StartedFlow
} from './core/auth/oauth';
export type { AuthRequest, AuthRoute } from './core/auth/routes';
