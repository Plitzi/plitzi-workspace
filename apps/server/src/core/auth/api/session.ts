import { authFailureMessage, userIdOf } from '../tokens';
import { totpStep } from '../totp';
import { refuse, NOT_OFFERED, asText, asString, now, deniedReason, clientOf } from './values';

import type { CredentialCarrier } from '../credentials';
import type { Actor } from '../identity';
import type { AuthContext } from './context';
import type { AuthOutcome } from './types';

/** Signing in and out: the session, a password or a provider's token, the second factor, refreshing and revoking. */
export const sessionFlows = ({
  tokens,
  adapters,
  verifyPassword,
  csrf,
  record,
  digestRecoveryCode,
  throttleSucceeded,
  throttled,
  capabilities,
  issue,
  grantBody,
  exchangeAccount
}: AuthContext) => ({
  capabilities,

  /** What a client reads to know which of the flows below actually exist here. */
  describe: (): AuthOutcome => ({ ok: true, body: { features: capabilities } }),

  /**
   * Who the caller is, and until when. Reaching a resolved actor at all is the answer to "is the session alive" —
   * the guard refuses with a `reason` when it could not, so a client learns whether to renew or to drop to
   * signed-out from the refusal itself. It costs no query: the actor was resolved before routing.
   */
  session: (actor?: Actor): AuthOutcome => {
    if (!actor) {
      return refuse(401, 'Not authenticated', 'missing');
    }

    const now = Math.floor(Date.now() / 1000);

    return {
      ok: true,
      body: {
        success: true,
        details: {
          id: actor.id,
          username: actor.username,
          email: actor.email,
          verified: actor.verified,
          roles: actor.roles,
          permissions: actor.permissions,
          // Only when somebody is being acted for. A UI that shows whose account this is has to be able to say
          // "you are viewing as", and it can only do that if the session endpoint admits it.
          ...(actor.impersonatedBy === undefined ? {} : { impersonatedBy: actor.impersonatedBy })
        },
        access_token: actor.token,
        expire_in: Math.max(0, actor.expiresAt - now),
        expire_at: actor.expiresAt
      }
    };
  },

  login: async (credentials: Record<string, unknown>, carrier?: CredentialCarrier): Promise<AuthOutcome> => {
    if (!capabilities.passwordLogin) {
      return NOT_OFFERED;
    }

    const username = asString(credentials.username);
    // Not trimmed: whitespace can be part of a password.
    const password = asText(credentials.password);
    if (!username || !password) {
      return refuse(400, 'A username and a password are required');
    }

    const limited = await throttled({ action: 'login', key: username, carrier });
    if (limited) {
      return limited;
    }

    /**
     * The username, or the email — in that order.
     *
     * Every sign-in screen worth using offers both, because the one thing a person reliably remembers about an
     * account is the address it was created with. Username first so an account whose name happens to be somebody
     * else's address cannot shadow the owner of that address; the email lookup only runs when the first misses,
     * so this costs a second query on a failed sign-in and nothing on a successful one.
     *
     * `findByEmail` is optional like everything else here: a deployment that supplies no email store keeps exactly
     * the behaviour it had.
     */
    const account =
      (await adapters.findByUsername?.(username)) ??
      (username.includes('@') ? await adapters.findByEmail?.(username) : undefined);
    if (!account) {
      return refuse(401, 'Invalid credentials');
    }

    // An account created through an identity provider carries no password. Never compare an empty hash: password
    // sign-in stays closed for it until its owner sets one through the reset flow.
    if (!account.passwordHash || !(await verifyPassword(password, account.passwordHash))) {
      record({ type: 'login.failed', userId: account.id, carrier, detail: { username } });

      return refuse(401, 'Invalid credentials');
    }

    /**
     * Whether this account may hold a session — asked AFTER the password, and that order is the point.
     *
     * Anything said about an account before its password is checked is said to anybody who types an address. The
     * other way round, "that address has not been confirmed" once cost nothing to establish: two attempts with a
     * made-up password told a stranger which of a list of addresses have accounts here and which do not. It is
     * only a refusal somebody has earned the right to understand once they have proved the account is theirs.
     */
    if (!account.active) {
      const reason = deniedReason(account);

      return refuse(401, authFailureMessage[reason], reason);
    }

    /**
     * The password was right. If there is a proven second factor, that buys a CHALLENGE and not a session — an
     * enrolment that was started and never confirmed does not count, or a scan that failed would lock the
     * account out of itself.
     */
    const mfa = capabilities.mfa ? await adapters.loadMfa?.(account.id) : undefined;
    if (mfa?.confirmedAt) {
      // The password was proved, so what this counter guards against did not happen: counted as a failure, an
      // account with a second factor was locked out by signing in often. The codes have a counter of their own.
      throttleSucceeded({ action: 'login', key: username, carrier });
      record({ type: 'login.mfa-required', userId: account.id, carrier });

      return {
        ok: true,
        body: { success: false, mfaRequired: true, mfaToken: tokens.generateMfaChallenge(account.id) }
      };
    }

    const session = await issue(account.id, { client: clientOf(carrier) });
    throttleSucceeded({ action: 'login', key: username, carrier });
    record({ type: 'login', userId: account.id, carrier });

    return { ok: true, body: await grantBody(account, session), session };
  },

  /**
   * The second half of a sign-in that owed a factor.
   *
   * Takes a TOTP code or a recovery code. A recovery code is SPENT — removed from the stored list — because one
   * that survives being used is a password with extra steps.
   */
  completeMfa: async (mfaToken: string, code: string, carrier?: CredentialCarrier): Promise<AuthOutcome> => {
    if (!capabilities.mfa) {
      return NOT_OFFERED;
    }

    const verified = tokens.verifyMfaChallenge(mfaToken);
    if (!verified.ok) {
      return refuse(401, authFailureMessage[verified.reason], verified.reason);
    }

    const userId = Number(verified.payload.sub);
    const limited = await throttled({ action: 'mfa', key: String(userId), carrier });
    if (limited) {
      return limited;
    }

    const account = await adapters.findById?.(userId);
    const mfa = await adapters.loadMfa?.(userId);
    if (!account || !mfa?.confirmedAt) {
      return refuse(401, 'Invalid credentials');
    }

    if (!account.active) {
      const reason = deniedReason(account);

      return refuse(401, authFailureMessage[reason], reason);
    }

    const stored = mfa.recoveryCodes ?? [];
    const supplied = digestRecoveryCode(code);
    const usedRecovery = stored.includes(supplied);
    const step = usedRecovery ? undefined : totpStep(mfa.secret, code);
    const replayed = step !== undefined && mfa.lastUsedStep !== undefined && step <= mfa.lastUsedStep;

    if (!usedRecovery && (step === undefined || replayed)) {
      record({ type: 'mfa.failed', userId, carrier, ...(replayed ? { detail: { replayed: true } } : {}) });

      return refuse(401, 'Invalid code');
    }

    // Spent before the session exists: a code is good for one sign-in, and a failure to record that must not
    // leave it good for another.
    await adapters.saveMfa?.(
      userId,
      usedRecovery
        ? { ...mfa, recoveryCodes: stored.filter(entry => entry !== supplied) }
        : { ...mfa, lastUsedStep: step }
    );

    const session = await issue(userId, { client: clientOf(carrier) });
    throttleSucceeded({ action: 'mfa', key: String(userId), carrier });
    record({ type: 'login', userId, carrier, detail: { recoveryCode: usedRecovery } });

    return {
      ok: true,
      body: { ...(await grantBody(account, session)), ...(usedRecovery ? { recoveryCodeUsed: true } : {}) },
      session
    };
  },

  refresh: async (refreshToken?: string, carrier?: CredentialCarrier): Promise<AuthOutcome> => {
    if (!capabilities.refresh) {
      return NOT_OFFERED;
    }

    if (!refreshToken) {
      return refuse(400, 'Refresh token is required');
    }

    /**
     * Every refusal below ends the session in this browser, because each of them means the credential it just
     * presented can never work again: not one this deployment signed, no such row, past its deadline, or an
     * account that may not hold one. What is being cleared is not authority — the row is already gone — it is the
     * browser's reason to keep asking.
     *
     * The token carries its own deadline, so the store is asked only whether it still holds the row — the switch
     * that revokes it. A `refreshExpiresAt` it reports overrides that deadline, and a store that keeps none needs
     * to report nothing.
     */
    const lapsed = { ...refuse(401, 'Invalid or expired refresh token', 'expired'), endSession: true };
    const verified = tokens.verifyRefreshToken(refreshToken);
    if (!verified.ok) {
      return lapsed;
    }

    const account = await adapters.findByRefreshToken?.(refreshToken);
    const deadline = account?.refreshExpiresAt ?? verified.payload.exp;
    if (!account || account.id !== userIdOf(verified.payload) || deadline === undefined || deadline < now()) {
      return lapsed;
    }

    if (!account.active) {
      const reason = deniedReason(account);

      return { ...refuse(401, authFailureMessage[reason], reason), endSession: true };
    }

    const cap = tokens.lifetimes.session;
    if (cap > 0 && account.sessionStartedAt !== undefined && account.sessionStartedAt + cap < now()) {
      // Ended rather than merely refused, or the row lingers until its refresh token ages out.
      await adapters.clearSession({ refreshToken });

      return { ...refuse(401, 'This session has reached its maximum lifetime', 'expired'), endSession: true };
    }

    const session = await issue(account.id, { replaces: { refreshToken }, client: clientOf(carrier) });

    return { ok: true, body: await grantBody(account, session), session };
  },

  /** Reachable with an expired access token on purpose, or a live refresh token could never be revoked. */
  logout: async (credentials: { accessToken?: string; refreshToken?: string }): Promise<AuthOutcome> => {
    if (credentials.accessToken || credentials.refreshToken) {
      await adapters.clearSession(credentials);
    }

    return { ok: true, body: { message: 'Logged out successfully' }, endSession: true };
  },

  /**
   * Ends this account's session everywhere, for the case where one leaked. Unlike logout it is authenticated and
   * works by account id, so it can be used from a device that still has a good session while the stolen copy is
   * somewhere else entirely.
   */
  revokeSessions: async (userId?: number): Promise<AuthOutcome> => {
    if (!userId) {
      return refuse(401, 'Not authenticated', 'missing');
    }

    await adapters.clearSession({ userId });

    return { ok: true, body: { message: 'All sessions revoked' }, endSession: true };
  },

  exchange: async (provider: string, token: string, carrier: CredentialCarrier): Promise<AuthOutcome> => {
    const result = await exchangeAccount(provider, token, carrier);
    if (!result.ok) {
      return result.offered ? refuse(result.status, result.error, result.reason) : NOT_OFFERED;
    }

    const { account, access, session } = result;

    return { ok: true, body: await grantBody(account, session, access), session };
  },

  /**
   * A CSRF token for whoever is asking, bound to their session when they have one. Answered as a body AND as the
   * cookie the binding writes, so a page can take whichever it finds easier to read.
   */
  issueCsrf: (sessionToken?: string): AuthOutcome => {
    if (!csrf) {
      return NOT_OFFERED;
    }

    const token = csrf.issue(sessionToken);

    return { ok: true, body: { token, headerName: csrf.headerName }, csrf: token };
  }
});
