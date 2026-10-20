import { authFailureMessage } from '../tokens';
import { generateRecoveryCodes, generateTotpSecret, randomCode, totpStep, totpUri } from '../totp';
import { refuse, NOT_OFFERED, asString, now, LIFETIME, deniedReason, clientOf } from './values';

import type { CredentialCarrier } from '../credentials';
import type { Actor } from '../identity';
import type { AuthContext } from './context';
import type { AuthOutcome } from './types';

/** The ways in besides a password: a code or a link by email (`passwordless`), and the second factor (`mfa`). */
export const factorsFlows = ({
  tokens,
  adapters,
  verifyPassword,
  mfaIssuer,
  record,
  digestRecoveryCode,
  deliver,
  throttleSucceeded,
  throttled,
  capabilities,
  issue,
  grantBody
}: AuthContext) => ({
  /**
   * Signing in with a code sent to an email address, and no password at all.
   *
   * Two decisions worth stating. **The request answers the same whether the address exists or not** — anything
   * else turns this endpoint into a way to ask which addresses have accounts. And **it never creates an
   * account**: a sign-in flow that silently registers whoever asks is a different feature, and one a deployment
   * should choose deliberately rather than inherit.
   */
  passwordless: {
    request: async (email: string, carrier?: CredentialCarrier): Promise<AuthOutcome> => {
      if (!capabilities.passwordless) {
        return NOT_OFFERED;
      }

      const address = asString(email).toLowerCase();
      if (!address) {
        return refuse(400, 'An email is required');
      }

      const limited = await throttled({ action: 'passwordless', key: address, carrier });
      if (limited) {
        return limited;
      }

      const account = await adapters.findByEmail?.(address);
      if (account?.active) {
        /**
         * Six characters somebody reads out of an email and types, not a link token — `generateToken` mints 128
         * random bits, which is right for something clicked and hostile for something retyped. Two different jobs
         * that were sharing one function, and the deployment that fixed the code for typing quietly weakened
         * every reset link it mailed.
         */
        const code = randomCode(6);
        await adapters.saveOtp?.({
          purpose: 'signin',
          identifier: address,
          codeHash: digestRecoveryCode(code),
          expiresAt: now() + LIFETIME.signInCode,
          userId: account.id
        });
        await deliver({
          to: account.email,
          template: 'signin-code',
          data: { username: account.username, code }
        });
      }

      // Identical either way, deliberately: see above.
      return { ok: true, body: { message: 'If that address has an account, a sign-in link is on its way' } };
    },

    complete: async (email: string, code: string, carrier?: CredentialCarrier): Promise<AuthOutcome> => {
      if (!capabilities.passwordless) {
        return NOT_OFFERED;
      }

      const address = asString(email).toLowerCase();
      if (!address || !code) {
        return refuse(400, 'An email and a code are required');
      }

      const limited = await throttled({ action: 'passwordless', key: address, carrier });
      if (limited) {
        return limited;
      }

      const stored = await adapters.findOtp?.('signin', address);
      if (!stored || stored.expiresAt < now() || stored.codeHash !== digestRecoveryCode(code)) {
        record({ type: 'login.failed', carrier, detail: { method: 'passwordless', email: address } });

        return refuse(401, 'Invalid or expired code');
      }

      // Spent before the session is minted: a code that survives being redeemed is a password sent by email.
      await adapters.consumeOtp?.(stored.id);

      const account = stored.userId === undefined ? undefined : await adapters.findById?.(stored.userId);
      if (!account?.active) {
        const reason = deniedReason(account);

        return refuse(401, authFailureMessage[reason], reason);
      }

      /**
       * A second factor still applies. Arriving by email proves the address, which is one factor — enrolling a
       * second one and then having it skipped by asking for a link would make it decorative.
       */
      const mfa = capabilities.mfa ? await adapters.loadMfa?.(account.id) : undefined;
      if (mfa?.confirmedAt) {
        record({ type: 'login.mfa-required', userId: account.id, carrier });

        return {
          ok: true,
          body: { success: false, mfaRequired: true, mfaToken: tokens.generateMfaChallenge(account.id) }
        };
      }

      const session = await issue(account.id, { client: clientOf(carrier) });
      throttleSucceeded({ action: 'passwordless', key: address, carrier });
      record({ type: 'login', userId: account.id, carrier, detail: { method: 'passwordless' } });

      return { ok: true, body: await grantBody(account, session), session };
    }
  },

  /**
   * Everything about this account's second factor. `begin` hands back a secret and the URI an app scans; nothing
   * is in force until `confirm` proves a code from it.
   */
  mfa: {
    status: async (actor: Actor | undefined): Promise<AuthOutcome> => {
      if (!capabilities.mfa) {
        return NOT_OFFERED;
      }

      if (!actor) {
        return refuse(401, 'Not authenticated', 'missing');
      }

      const mfa = await adapters.loadMfa?.(actor.id);

      return {
        ok: true,
        body: {
          enabled: Boolean(mfa?.confirmedAt),
          pending: Boolean(mfa && !mfa.confirmedAt),
          recoveryCodesRemaining: mfa?.recoveryCodes?.length ?? 0
        }
      };
    },

    begin: async (actor: Actor | undefined): Promise<AuthOutcome> => {
      if (!capabilities.mfa) {
        return NOT_OFFERED;
      }

      if (!actor) {
        return refuse(401, 'Not authenticated', 'missing');
      }

      const existing = await adapters.loadMfa?.(actor.id);
      if (existing?.confirmedAt) {
        return refuse(409, 'A second factor is already set up. Remove it before enrolling another.');
      }

      // A fresh secret every time enrolment restarts: reusing an abandoned one would let a half-finished scan
      // from an old device keep working.
      const secret = generateTotpSecret();
      await adapters.saveMfa?.(actor.id, { secret });

      return {
        ok: true,
        body: {
          secret,
          uri: totpUri({ secret, account: actor.email || actor.username, issuer: mfaIssuer ?? tokens.issuer })
        }
      };
    },

    /** Proves the app was actually set up, and only then does the factor start being required. */
    confirm: async (actor: Actor | undefined, code: string): Promise<AuthOutcome> => {
      if (!capabilities.mfa) {
        return NOT_OFFERED;
      }

      if (!actor) {
        return refuse(401, 'Not authenticated', 'missing');
      }

      const mfa = await adapters.loadMfa?.(actor.id);
      if (!mfa) {
        return refuse(400, 'Start the enrolment first');
      }

      if (mfa.confirmedAt) {
        return refuse(409, 'A second factor is already set up');
      }

      const step = totpStep(mfa.secret, code);
      if (step === undefined) {
        record({ type: 'mfa.failed', userId: actor.id });

        return refuse(401, 'Invalid code');
      }

      // Shown once and stored hashed, which is what makes them worth having: a deployment that could print them
      // again is a deployment where reading the database is enough to bypass the second factor. The code that
      // proved the enrolment is spent like any other: it does not also sign somebody in.
      const plain = generateRecoveryCodes();
      await adapters.saveMfa?.(actor.id, {
        ...mfa,
        confirmedAt: Math.floor(Date.now() / 1000),
        recoveryCodes: plain.map(digestRecoveryCode),
        lastUsedStep: step
      });
      record({ type: 'mfa.enabled', userId: actor.id });

      return { ok: true, body: { success: true, recoveryCodes: plain } };
    },

    /** Removing a factor is a security downgrade, so it asks for the password the way deleting an account does. */
    disable: async (actor: Actor | undefined, password?: string): Promise<AuthOutcome> => {
      if (!capabilities.mfa || !adapters.deleteMfa) {
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

      await adapters.deleteMfa(actor.id);
      record({ type: 'mfa.disabled', userId: actor.id });

      return { ok: true, body: { success: true } };
    }
  }
});
