import { refuse, NOT_OFFERED, asString, LIFETIME, profileOf } from './values';

import type { Actor } from '../identity';
import type { AuthContext } from './context';
import type { AuthOutcome } from './types';

/** What a signed-in person does to their own account: the profile, the address, the password, the sessions. */
export const profileFlows = ({
  adapters,
  verifyPassword,
  hashPassword,
  generateToken,
  record,
  mintLink,
  linkExpired,
  deliver,
  throttleSucceeded,
  throttled,
  rejectPassword,
  capabilities
}: AuthContext) => ({
  /**
   * Change what an account says about itself.
   *
   * Both fields are sign-in identifiers, so both are checked for collision first — a store that only has a unique
   * index reports the clash as a driver error five hundred lines away.
   */
  updateProfile: async (actor: Actor | undefined, fields: Record<string, unknown>): Promise<AuthOutcome> => {
    if (!capabilities.profile || !adapters.updateAccount) {
      return NOT_OFFERED;
    }

    if (!actor) {
      return refuse(401, 'Not authenticated', 'missing');
    }

    const username = asString(fields.username);
    const email = asString(fields.email);
    if (!username && !email) {
      return refuse(400, 'Nothing to change');
    }

    if (username && username !== actor.username) {
      const taken = await adapters.findByUsername?.(username);
      if (taken && taken.id !== actor.id) {
        return refuse(409, 'That username is taken');
      }
    }

    if (email && email !== actor.email) {
      const taken = await adapters.findByEmail?.(email);
      if (taken && taken.id !== actor.id) {
        return refuse(409, 'That email is taken');
      }
    }

    const changingEmail = Boolean(email) && email !== actor.email;

    /**
     * A new address is PARKED, not applied: the account keeps the one it has until the new one answers a
     * confirmation. That is what makes a typo survivable — `n@exmaple.com` costs a resend, not the account.
     *
     * The alternative, applying it and taking `verified` away, was tried and reverted: `verified` in this server
     * gates ACCESS (`createAuthorizer` refuses to present an unverified account as an actor at all), so it locked
     * people out of the account they were sitting in. And the attack it guarded against needs a live session,
     * from which the same person could simply change the password.
     *
     * A deployment that supplies nowhere to park it changes the address on the spot, as it always did.
     */
    const parking = changingEmail && capabilities.emailChange;

    const account = await adapters.updateAccount(actor.id, {
      ...(username ? { username } : {}),
      ...(email && !parking ? { email } : {})
    });

    if (parking && adapters.setPendingEmail) {
      const confirmationToken = mintLink(generateToken(), LIFETIME.confirmLink);
      await adapters.setPendingEmail(actor.id, email, confirmationToken);
      await deliver({
        to: email,
        template: 'email-change',
        data: { username: account.username, email, confirmationToken }
      });

      return {
        ok: true,
        body: {
          success: true,
          details: profileOf(account),
          pendingEmail: email,
          message: 'A confirmation was sent to the new address. It takes effect once confirmed.'
        }
      };
    }

    if (changingEmail && capabilities.emailVerification && adapters.setValidationToken) {
      const validationToken = mintLink(generateToken(), LIFETIME.confirmLink);
      await adapters.setValidationToken(actor.id, validationToken);
      await deliver({
        to: account.email,
        template: 'validation',
        data: { username: account.username, validationToken }
      });

      return {
        ok: true,
        body: {
          success: true,
          details: profileOf(account),
          message: 'A confirmation was sent to the new address'
        }
      };
    }

    return { ok: true, body: { success: true, details: profileOf(account) } };
  },

  /**
   * Takes the parked address, having proved somebody reads it.
   *
   * Public, and it has to be: the link is opened from a mail client, in whatever browser that happens to be, with
   * no session. The token is the whole credential — which is why it is single-use and why confirming also marks
   * the account verified: an address that answered a link is an address that was proven.
   */
  confirmEmailChange: async (token: string): Promise<AuthOutcome> => {
    if (!capabilities.emailChange || !adapters.findByPendingEmail || !adapters.clearPendingEmail) {
      return NOT_OFFERED;
    }

    const confirmation = asString(token);
    const pending = linkExpired(confirmation) ? undefined : await adapters.findByPendingEmail(confirmation);
    if (!pending) {
      return refuse(400, 'Invalid or expired token');
    }

    // Between asking and confirming, somebody else may have signed up with it. Sign-in identifiers are unique, so
    // this has to be refused here rather than surfacing as a driver error from the write below.
    const taken = await adapters.findByEmail?.(pending.email);
    if (taken && taken.id !== pending.account.id) {
      await adapters.clearPendingEmail(pending.account.id);

      return refuse(409, 'That email is taken');
    }

    const account = await adapters.updateAccount?.(pending.account.id, { email: pending.email });
    await adapters.clearPendingEmail(pending.account.id);

    if (adapters.setVerified) {
      await adapters.setVerified(pending.account.id, true);
    }

    record({ type: 'email.changed', userId: pending.account.id, detail: { email: pending.email } });

    const confirmed = { ...(account ?? pending.account), email: pending.email };

    return {
      ok: true,
      body: {
        success: true,
        details: profileOf(adapters.setVerified ? { ...confirmed, verified: true } : confirmed)
      }
    };
  },

  /**
   * Change a password, having proved you know the current one.
   *
   * Then **every other session ends**. Changing a password is what somebody does when they think a credential
   * escaped, and one that leaves the other sessions signed in has not done the thing they asked for. The session
   * making the change survives, or the act of securing the account would sign them out of it.
   */
  changePassword: async (
    actor: Actor | undefined,
    currentPassword: string,
    newPassword: string
  ): Promise<AuthOutcome> => {
    if (!capabilities.passwordChange || !adapters.findById) {
      return NOT_OFFERED;
    }

    if (!actor) {
      return refuse(401, 'Not authenticated', 'missing');
    }

    if (!currentPassword || !newPassword) {
      return refuse(400, 'The current and the new password are required');
    }

    const weak = await rejectPassword(newPassword, { username: actor.username, email: actor.email });
    if (weak) {
      return weak;
    }

    const limited = await throttled({ action: 'changePassword', key: String(actor.id) });
    if (limited) {
      return limited;
    }

    const account = await adapters.findById(actor.id);
    if (!account?.passwordHash || !(await verifyPassword(currentPassword, account.passwordHash))) {
      return refuse(401, 'Invalid credentials');
    }

    await adapters.setPassword?.(actor.id, await hashPassword(newPassword));
    await adapters.revokeOtherSessions?.(actor.id, actor.token);
    throttleSucceeded({ action: 'changePassword', key: String(actor.id) });
    record({ type: 'password.changed', userId: actor.id });

    return { ok: true, body: { success: true, message: 'Password changed. Other sessions were signed out.' } };
  },

  /**
   * Close the account.
   *
   * Confirmed with the password when there is one — this is irreversible, and a borrowed session should not be
   * able to do it. An account with no password (one that signs in through a provider) cannot be asked, so the
   * session alone has to be enough.
   */
  deleteSelf: async (actor: Actor | undefined, password?: string): Promise<AuthOutcome> => {
    if (!capabilities.accountDeletion || !adapters.deleteAccount) {
      return NOT_OFFERED;
    }

    if (!actor) {
      return refuse(401, 'Not authenticated', 'missing');
    }

    const account = await adapters.findById?.(actor.id);
    if (account?.passwordHash) {
      if (!password || !(await verifyPassword(password, account.passwordHash))) {
        return refuse(401, 'Invalid credentials');
      }
    }

    // After the password, so a borrowed session learns nothing about what the account owns without it.
    const blockers = (await adapters.deletionBlockers?.(actor.id)) ?? [];
    if (blockers.length > 0) {
      return {
        ok: false,
        status: 409,
        body: { error: 'This account still owns things that would be lost with it', blockers }
      };
    }

    await adapters.deleteAccount(actor.id);
    record({ type: 'account.deleted', userId: actor.id });

    return { ok: true, body: { success: true, message: 'Account deleted' }, endSession: true };
  },

  /** The devices this account is signed in on, with the one asking marked. */
  listSessions: async (actor: Actor | undefined): Promise<AuthOutcome> => {
    if (!capabilities.sessionList || !adapters.listSessions) {
      return NOT_OFFERED;
    }

    if (!actor) {
      return refuse(401, 'Not authenticated', 'missing');
    }

    return { ok: true, body: { sessions: await adapters.listSessions(actor.id, actor.token) } };
  },

  /** End one of them. Scoped to the caller's own account, or a session id would be an IDOR. */
  revokeSession: async (actor: Actor | undefined, sessionId: number): Promise<AuthOutcome> => {
    if (!adapters.revokeSession) {
      return NOT_OFFERED;
    }

    if (!actor) {
      return refuse(401, 'Not authenticated', 'missing');
    }

    if (!Number.isInteger(sessionId)) {
      return refuse(400, 'A session id is required');
    }

    const removed = await adapters.revokeSession(actor.id, sessionId);

    return removed ? { ok: true, body: { success: true } } : refuse(404, 'No such session');
  },

  /** "Sign out everywhere else" — the thing to do from a device you still hold after losing one you do not. */
  revokeOtherSessions: async (actor: Actor | undefined): Promise<AuthOutcome> => {
    if (!adapters.revokeOtherSessions) {
      return NOT_OFFERED;
    }

    if (!actor) {
      return refuse(401, 'Not authenticated', 'missing');
    }

    return { ok: true, body: { success: true, revoked: await adapters.revokeOtherSessions(actor.id, actor.token) } };
  }
});
