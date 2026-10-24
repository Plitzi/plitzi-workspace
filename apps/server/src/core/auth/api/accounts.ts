import { refuse, NOT_OFFERED, asText, asString, destinationOf, LIFETIME } from './values';

import type { AuthContext } from './context';
import type { AuthOutcome } from './types';

/** An account made and recovered: signing up, verifying the address, forgetting and resetting the password. */
export const accountsFlows = ({
  adapters,
  hashPassword,
  generateToken,
  verifyOnSignup,
  record,
  mintLink,
  linkExpired,
  deliver,
  throttled,
  rejectPassword,
  capabilities
}: AuthContext) => ({
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

    const weak = await rejectPassword(password, { username, email });
    if (weak) {
      return weak;
    }

    const limited = await throttled({ action: 'signup', key: email });
    if (limited) {
      return limited;
    }

    // Which one is taken, for the form to mark its field (encore's sign-up said it under the form): no more than "a user
    // exists" already told, as that answered the same for an email tried with any username.
    const taken = (await adapters.findByUsername?.(username))
      ? 'username'
      : (await adapters.findByEmail?.(email))
        ? 'email'
        : undefined;
    if (taken) {
      return {
        ok: false,
        status: 400,
        body: {
          error: taken === 'username' ? 'That username is taken' : 'An account with that email already exists',
          field: taken
        }
      };
    }

    // Both are guaranteed by `capabilities.signup`; asserting it here keeps that guarantee where it is decided.
    if (!adapters.createAccount) {
      return NOT_OFFERED;
    }

    const account = await adapters.createAccount({
      username,
      email,
      passwordHash: await hashPassword(password)
    });

    if (!verifyOnSignup && capabilities.emailVerification && adapters.setValidationToken) {
      const validationToken = mintLink(generateToken(), LIFETIME.confirmLink);
      await adapters.setValidationToken(account.id, validationToken);
      await deliver({
        to: email,
        template: 'validation',
        data: { username, validationToken, ...destinationOf(fields.redirect) }
      });
    }

    record({ type: 'signup', userId: account.id });

    return { ok: true, status: 201, body: { message: 'User created successfully', userId: account.id } };
  },

  /** Answers the same either way: whether an address has an account here is not something a stranger may probe. */
  forgotPassword: async (email: string): Promise<AuthOutcome> => {
    if (!capabilities.passwordReset) {
      return NOT_OFFERED;
    }

    // Throttled by address, or this endpoint is a way to send somebody a hundred emails.
    const limited = await throttled({ action: 'forgotPassword', key: asString(email) });
    if (limited) {
      return limited;
    }

    const account = await adapters.findByEmail?.(asString(email));
    if (account) {
      const resetToken = mintLink(generateToken(), LIFETIME.resetLink);
      await adapters.setResetToken?.(account.id, resetToken);
      await deliver({
        to: account.email,
        template: 'password-reset',
        data: { username: account.username, resetToken }
      });
    }

    return { ok: true, body: { message: 'Password reset email sent' } };
  },

  resetPassword: async (token: string, password: string): Promise<AuthOutcome> => {
    if (!capabilities.passwordReset) {
      return NOT_OFFERED;
    }

    if (!token || !password) {
      return refuse(400, 'A token and a password are required');
    }

    // Throttled by token: without it a reset token is guessable by trying, however opaque it is.
    const limited = await throttled({ action: 'resetPassword', key: token });
    if (limited) {
      return limited;
    }

    // The deadline first: an expired token must not be looked up as though it were live, and the answer is the
    // same either way — telling the two apart would say whether the token ever existed.
    const account = linkExpired(token) ? undefined : await adapters.findByResetToken?.(token);
    if (!account) {
      return refuse(400, 'Invalid or expired token');
    }

    const weak = await rejectPassword(password, { username: account.username, email: account.email });
    if (weak) {
      return weak;
    }

    await adapters.setPassword?.(account.id, await hashPassword(password));
    await adapters.setResetToken?.(account.id, '');
    // Whoever forced the reset — or stole the old password — must not keep a working session.
    await adapters.clearSession({ userId: account.id });

    record({ type: 'password.reset', userId: account.id });

    return { ok: true, body: { message: 'Password reset successfully' }, endSession: true };
  },

  validateAccount: async (token: string): Promise<AuthOutcome> => {
    if (!capabilities.emailVerification) {
      return NOT_OFFERED;
    }

    const account = linkExpired(token) ? undefined : await adapters.findByValidationToken?.(token);
    if (!account) {
      return refuse(400, 'Invalid or expired token');
    }

    await adapters.setVerified?.(account.id, true);

    return { ok: true, body: { message: 'Account validated successfully' } };
  },

  resendVerification: async (email: string, redirect?: string): Promise<AuthOutcome> => {
    if (!capabilities.emailVerification) {
      return NOT_OFFERED;
    }

    const account = await adapters.findByEmail?.(asString(email));
    if (account && !account.verified) {
      const validationToken = mintLink(generateToken(), LIFETIME.confirmLink);
      await adapters.setValidationToken?.(account.id, validationToken);
      await deliver({
        to: account.email,
        template: 'validation',
        data: { username: account.username, validationToken, ...destinationOf(redirect) }
      });
    }

    return { ok: true, body: { message: 'Verification email resent' } };
  }
});
