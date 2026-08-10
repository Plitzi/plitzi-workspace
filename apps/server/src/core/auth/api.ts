import type { CredentialCarrier } from './credentials';
import type { Actor, Identity } from './identity';
import type { AuthFailure, Tokens } from './tokens';
import type { SSRSession } from '@plitzi/sdk-shared';

/**
 * An account, as whatever stores accounts reports one. Deliberately not a user model: these are the only fields any
 * decision here is made on, and a deployment maps its own row onto them.
 */
export interface AccountRecord {
  id: number;
  username: string;
  email: string;
  /** Suspended, deactivated, whatever the deployment calls it — an inactive account never gets a session. */
  active: boolean;
  /** Confirmed their address. An unverified account may still sign in; what it may *do* is a matter for RBAC. */
  verified: boolean;
  /** Absent for accounts that have no password — one created through an identity provider, for instance. */
  passwordHash?: string;
  /** Unix seconds, for the refresh credential this account currently holds. */
  refreshExpiresAt?: number;
}

export interface AccountAccess {
  roles: string[];
  permissions: string[];
}

/**
 * The account store, as auth needs to see it. Every method is optional except the three the session cycle cannot do
 * without, and **what is absent decides what this server offers**: a deployment with no `createAccount` has no
 * signup, and its route answers 404 rather than failing at runtime. That rule is what lets one server serve a
 * deployment with its own user table and one that signs everybody in through an external provider.
 */
export interface AccountAdapters {
  /** Persist a freshly minted pair. Storing it is what retires the previous one — the whole of rotation. */
  saveSession: (userId: number, session: SSRSession) => Promise<void>;
  /** Clear the pair, by whichever half the caller holds, or by account. */
  clearSession: (target: { accessToken?: string; refreshToken?: string; userId?: number }) => Promise<void>;
  /** Global roles and permissions, for the body a grant answers with. */
  loadAccess: (userId: number) => Promise<AccountAccess>;

  findByUsername?: (username: string) => Promise<AccountRecord | undefined>;
  findByRefreshToken?: (token: string) => Promise<AccountRecord | undefined>;
  createAccount?: (account: { username: string; email: string; passwordHash: string }) => Promise<AccountRecord>;
  findByEmail?: (email: string) => Promise<AccountRecord | undefined>;
  setPassword?: (userId: number, passwordHash: string) => Promise<void>;
  setResetToken?: (userId: number, token: string) => Promise<void>;
  findByResetToken?: (token: string) => Promise<AccountRecord | undefined>;
  setValidationToken?: (userId: number, token: string) => Promise<void>;
  findByValidationToken?: (token: string) => Promise<AccountRecord | undefined>;
  markVerified?: (userId: number) => Promise<void>;
  /** Called for validation and password-reset mail. Without it neither flow is offered. */
  sendMail?: (message: { to: string; template: string; data: Record<string, string> }) => Promise<void>;
  /**
   * Turn a credential the browser obtained from an identity provider into an account here. Everything that decides
   * whether the credential is any good — which providers this deployment trusts, and that the token was minted for
   * *this* application — lives in the implementation, because only it knows.
   */
  exchangeCredential?: (
    provider: string,
    token: string,
    carrier: CredentialCarrier
  ) => Promise<AccountRecord | { error: string; status?: number } | undefined>;
}

export interface AuthApiConfig {
  /** Compare a password against a stored hash. A deployment picks its own algorithm; nothing here assumes one. */
  verifyPassword?: (plain: string, hash: string) => Promise<boolean>;
  hashPassword?: (plain: string) => Promise<string>;
  /** Opaque, single-use strings for validation and reset links. */
  generateToken?: () => string;
  /** Whether a new account may sign in immediately or has to confirm its address first. */
  verifyOnSignup?: boolean;
}

/** What a handler answers: a body, and optionally what should happen to the session cookies. */
export type AuthOutcome =
  | { ok: true; status?: number; body: object; session?: SSRSession; endSession?: boolean }
  | { ok: false; status: number; body: object };

const refuse = (status: number, error: string, reason?: AuthFailure): AuthOutcome => ({
  ok: false,
  status,
  body: reason ? { error, reason } : { error }
});

const NOT_OFFERED = refuse(404, 'Not found');

/**
 * A field from a request body, as a string. Numbers count: JSON carries an all-digits password as a number, and a
 * client that sends one has supplied a password — refusing it as "credentials are required" is a lie about what
 * arrived. Objects and arrays do not, since `[object Object]` is not a value anybody sent.
 */
const asText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
};

const asString = (value: unknown): string => asText(value).trim();

/**
 * The HTTP surface of authentication, as functions rather than routes.
 *
 * Nothing here knows about Express, or about this server's own pipeline: a handler is given what the request
 * carried and answers what should be sent, including whether the session cookies should be written or cleared. The
 * binding does the rest, which is what lets the same login live behind an API endpoint and behind a rendered page's
 * form without either owning it.
 */
export const createAuthApi = ({
  tokens,
  identity,
  adapters,
  config = {}
}: {
  tokens: Tokens;
  identity: Identity;
  adapters: AccountAdapters;
  config?: AuthApiConfig;
}) => {
  const { verifyPassword, hashPassword, generateToken, verifyOnSignup = false } = config;

  /**
   * What this deployment offers, decided by what it supplied and nothing else.
   *
   * There used to be a parallel set of `features` switches. They were redundant in every case — each flow reads
   * adapters that no other flow reads, so leaving one out is already how you decline it — and two ways of saying
   * the same thing invite the state where they disagree: an adapter wired up, the flag forgotten, and an endpoint
   * that answers 404 for no reason anyone can see. Declining a flow is now one act: do not implement it.
   */
  const capabilities = {
    passwordLogin: !!adapters.findByUsername && !!verifyPassword,
    refresh: !!adapters.findByRefreshToken,
    signup: !!adapters.createAccount && !!hashPassword,
    passwordReset: !!adapters.findByEmail && !!adapters.setResetToken && !!hashPassword,
    emailVerification: !!adapters.findByValidationToken && !!adapters.markVerified,
    exchange: !!adapters.exchangeCredential
  };

  const issue = async (userId: number): Promise<SSRSession> => {
    const now = Math.floor(Date.now() / 1000);
    const session: SSRSession = {
      token: tokens.generateUserToken(userId),
      expiresAt: now + tokens.lifetimes.access,
      refreshToken: tokens.generateRefreshToken(userId),
      refreshExpiresAt: now + tokens.lifetimes.refresh
    };

    await adapters.saveSession(userId, session);

    return session;
  };

  /**
   * The body a grant answers with. `details` is the same object the session endpoint returns, deliberately: it makes
   * a grant an identity, so a client that has just signed in or renewed knows who it is without a second request.
   */
  const grantBody = async (account: AccountRecord, session: SSRSession): Promise<object> => {
    const access = await adapters.loadAccess(account.id);
    const now = Math.floor(Date.now() / 1000);

    return {
      success: true,
      details: {
        id: account.id,
        username: account.username,
        email: account.email,
        verified: account.verified,
        roles: access.roles,
        permissions: access.permissions
      },
      access_token: session.token,
      expire_in: Math.max(0, session.expiresAt - now),
      expire_at: session.expiresAt,
      refresh_token: session.refreshToken,
      refresh_expire_in: Math.max(0, (session.refreshExpiresAt ?? 0) - now),
      refresh_expire_at: session.refreshExpiresAt
    };
  };

  return {
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
            permissions: actor.permissions
          },
          access_token: actor.token,
          expire_in: Math.max(0, actor.expiresAt - now),
          expire_at: actor.expiresAt
        }
      };
    },

    login: async (credentials: Record<string, unknown>): Promise<AuthOutcome> => {
      if (!capabilities.passwordLogin) {
        return NOT_OFFERED;
      }

      const username = asString(credentials.username);
      // Not trimmed: whitespace can be part of a password.
      const password = asText(credentials.password);
      if (!username || !password) {
        return refuse(400, 'A username and a password are required');
      }

      const account = await adapters.findByUsername?.(username);
      if (!account) {
        return refuse(401, 'Invalid credentials');
      }

      if (!account.active) {
        return refuse(401, 'Account is not active');
      }

      // An account created through an identity provider carries no password. Never compare an empty hash: password
      // sign-in stays closed for it until its owner sets one through the reset flow.
      if (!account.passwordHash || !(await verifyPassword?.(password, account.passwordHash))) {
        return refuse(401, 'Invalid credentials');
      }

      const session = await issue(account.id);

      return { ok: true, body: await grantBody(account, session), session };
    },

    refresh: async (refreshToken?: string): Promise<AuthOutcome> => {
      if (!capabilities.refresh) {
        return NOT_OFFERED;
      }

      if (!refreshToken) {
        return refuse(400, 'Refresh token is required');
      }

      const account = await adapters.findByRefreshToken?.(refreshToken);
      if (!account || !account.refreshExpiresAt || account.refreshExpiresAt < Math.floor(Date.now() / 1000)) {
        return refuse(401, 'Invalid or expired refresh token', 'expired');
      }

      if (!account.active) {
        return refuse(401, 'Account is not active', 'inactive');
      }

      const session = await issue(account.id);

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
      if (!capabilities.exchange) {
        return NOT_OFFERED;
      }

      if (!provider || !token) {
        return refuse(400, 'A provider and a token are required');
      }

      const result = await adapters.exchangeCredential?.(provider, token, carrier);
      if (!result) {
        return refuse(401, 'Token Invalid', 'revoked');
      }

      if ('error' in result) {
        return refuse(result.status ?? 400, result.error, 'revoked');
      }

      const session = await issue(result.id);

      return { ok: true, body: await grantBody(result, session), session };
    },

    signup: async (fields: Record<string, unknown>): Promise<AuthOutcome> => {
      if (!capabilities.signup) {
        return NOT_OFFERED;
      }

      const username = asString(fields.username);
      const email = asString(fields.email);
      const password = asText(fields.password);
      if (!username || !email || !password) {
        return refuse(400, 'A username, an email and a password are required');
      }

      if ((await adapters.findByUsername?.(username)) ?? (await adapters.findByEmail?.(email))) {
        return refuse(400, 'User already exists');
      }

      // Both are guaranteed by `capabilities.signup`; asserting it here keeps that guarantee where it is decided.
      if (!adapters.createAccount || !hashPassword) {
        return NOT_OFFERED;
      }

      const account = await adapters.createAccount({
        username,
        email,
        passwordHash: await hashPassword(password)
      });

      if (!verifyOnSignup && capabilities.emailVerification && generateToken && adapters.setValidationToken) {
        const validationToken = generateToken();
        await adapters.setValidationToken(account.id, validationToken);
        await adapters.sendMail?.({ to: email, template: 'validation', data: { username, validationToken } });
      }

      return { ok: true, status: 201, body: { message: 'User created successfully', userId: account.id } };
    },

    /** Answers the same either way: whether an address has an account here is not something a stranger may probe. */
    forgotPassword: async (email: string): Promise<AuthOutcome> => {
      if (!capabilities.passwordReset || !generateToken) {
        return NOT_OFFERED;
      }

      const account = await adapters.findByEmail?.(asString(email));
      if (account) {
        const resetToken = generateToken();
        await adapters.setResetToken?.(account.id, resetToken);
        await adapters.sendMail?.({
          to: account.email,
          template: 'password-reset',
          data: { username: account.username, resetToken }
        });
      }

      return { ok: true, body: { message: 'Password reset email sent' } };
    },

    resetPassword: async (token: string, password: string): Promise<AuthOutcome> => {
      if (!capabilities.passwordReset || !hashPassword) {
        return NOT_OFFERED;
      }

      if (!token || !password) {
        return refuse(400, 'A token and a password are required');
      }

      const account = await adapters.findByResetToken?.(token);
      if (!account) {
        return refuse(400, 'Invalid or expired token');
      }

      await adapters.setPassword?.(account.id, await hashPassword(password));
      await adapters.setResetToken?.(account.id, '');
      // Whoever forced the reset — or stole the old password — must not keep a working session.
      await adapters.clearSession({ userId: account.id });

      return { ok: true, body: { message: 'Password reset successfully' }, endSession: true };
    },

    validateAccount: async (token: string): Promise<AuthOutcome> => {
      if (!capabilities.emailVerification) {
        return NOT_OFFERED;
      }

      const account = await adapters.findByValidationToken?.(token);
      if (!account) {
        return refuse(400, 'Invalid or expired token');
      }

      await adapters.markVerified?.(account.id);

      return { ok: true, body: { message: 'Account validated successfully' } };
    },

    resendVerification: async (email: string): Promise<AuthOutcome> => {
      if (!capabilities.emailVerification || !generateToken) {
        return NOT_OFFERED;
      }

      const account = await adapters.findByEmail?.(asString(email));
      if (account && !account.verified) {
        const validationToken = generateToken();
        await adapters.setValidationToken?.(account.id, validationToken);
        await adapters.sendMail?.({
          to: account.email,
          template: 'validation',
          data: { username: account.username, validationToken }
        });
      }

      return { ok: true, body: { message: 'Verification email resent' } };
    },

    /** Exposed so a deployment can mint a session outside the flows above — a rendered page's login form. */
    issueSession: issue,
    resolveActor: identity.resolveActor
  };
};

export type AuthApi = ReturnType<typeof createAuthApi>;
