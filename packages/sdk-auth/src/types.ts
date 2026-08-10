import type { Schema } from '@plitzi/sdk-shared';

/**
 * Everything a space declares about its auth backend, handed to whichever provider it selected. Derived from the
 * schema rather than restated, so a setting added there reaches providers without a second definition to keep in step.
 */
export type AuthProviderSettings = Pick<
  Schema['settings'],
  | 'tokenStorage'
  | 'loginUrl'
  | 'userUrl'
  | 'refreshUrl'
  | 'logoutUrl'
  | 'detailsPath'
  | 'tokenPath'
  | 'refreshTokenPath'
  | 'expirationTimePath'
  | 'refreshExpirationTimePath'
  | 'sessionHintCookie'
  | 'sessionExchangeUrl'
  | 'sessionGate'
  | 'sessionRevalidateSeconds'
>;
