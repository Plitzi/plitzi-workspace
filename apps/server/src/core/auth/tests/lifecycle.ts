import { createAuthApi } from '../api';
import { createCarriers, presentedOrigin } from '../credentials';
import { createIdentity } from '../identity';
import { createTokens } from '../tokens';

import type { AccountAdapters, AccountRecord, AuthApiConfig, AuthOutcome } from '../api';
import type { Actor } from '../identity';

/**
 * The account's life after it exists: what it may change about itself, what an administrator may change about it,
 * and what each of those does to the sessions it is holding. Everything here is a rule the server owns, so it is
 * asserted against fake adapters rather than a database.
 */
export const ada: AccountRecord = {
  id: 1,
  username: 'ada',
  email: 'ada@example.test',
  active: true,
  verified: true,
  passwordHash: 'hash:pw'
};

export const actorFor = (account: AccountRecord, permissions: string[] = []): Actor => ({
  id: account.id,
  username: account.username,
  email: account.email,
  verified: account.verified,
  roles: [],
  permissions,
  token: `token-${account.id}`,
  expiresAt: Math.floor(Date.now() / 1000) + 3600
});

export const TOKENS = { secret: 'test-secret', issuer: 'https://test' };

export const build = (adapters: Partial<AccountAdapters> = {}, config: AuthApiConfig = {}) => {
  const tokens = createTokens(TOKENS);
  const full: AccountAdapters = {
    saveSession: () => Promise.resolve(),
    clearSession: () => Promise.resolve(),
    loadAccess: () => Promise.resolve({ roles: [], permissions: [] }),
    ...adapters
  };

  const identity = createIdentity({
    tokens,
    carriers: createCarriers(() => 'sess'),
    presentedOrigin,
    adapters: { findAccountByToken: () => Promise.resolve(undefined) }
  });

  return createAuthApi({
    tokens,
    identity,
    adapters: full,
    config: {
      verifyPassword: (plain, hash) => Promise.resolve(hash === `hash:${plain}`),
      hashPassword: plain => Promise.resolve(`hash:${plain}`),
      ...config
    }
  });
};

export const body = (outcome: AuthOutcome): Record<string, unknown> => outcome.body as Record<string, unknown>;
