import { checkPermission } from '../authorize';
import { refuse, NOT_OFFERED, LIFETIME, STATUSES, profileOf, clientOf } from './values';

import type { CredentialCarrier } from '../credentials';
import type { Actor } from '../identity';
import type { AuthContext } from './context';
import type { AccountStatus, AccountQuery, AuthOutcome } from './types';

/** What an admin does to other accounts. */
export const adminFlows = ({
  adapters,
  impersonationPermission,
  record,
  capabilities,
  requireAdmin,
  issue,
  grantBody
}: AuthContext) => ({
  admin: {
    list: async (actor: Actor | undefined, query: AccountQuery): Promise<AuthOutcome> => {
      const denial = requireAdmin(actor);
      if (denial) {
        return denial;
      }

      if (!adapters.listAccounts) {
        return NOT_OFFERED;
      }

      const { accounts, total } = await adapters.listAccounts(query);

      return { ok: true, body: { accounts: accounts.map(profileOf), total } };
    },

    get: async (actor: Actor | undefined, userId: number): Promise<AuthOutcome> => {
      const denial = requireAdmin(actor);
      if (denial) {
        return denial;
      }

      const account = await adapters.findById?.(userId);
      if (!account) {
        return refuse(404, 'No such account');
      }

      return { ok: true, body: { account: profileOf(account), access: await adapters.loadAccess(userId) } };
    },

    /**
     * Suspend, block or restore an account — and **end its sessions when it stops being active**.
     *
     * That second half is the whole point. A ban that leaves the credential working is not a ban, it is a note
     * in a database; the person stays signed in until their token happens to lapse.
     */
    setStatus: async (actor: Actor | undefined, userId: number, status: AccountStatus): Promise<AuthOutcome> => {
      const denial = requireAdmin(actor, userId);
      if (denial) {
        return denial;
      }

      if (!adapters.setStatus) {
        return NOT_OFFERED;
      }

      if (!STATUSES.includes(status)) {
        return refuse(400, `Status must be one of ${STATUSES.join(', ')}`);
      }

      if (!(await adapters.findById?.(userId))) {
        return refuse(404, 'No such account');
      }

      await adapters.setStatus(userId, status);

      if (status !== 'active') {
        await adapters.clearSession({ userId });
      }

      record({ type: 'admin.status-changed', userId, actorId: actor?.id, detail: { status } });

      return { ok: true, body: { success: true, status } };
    },

    setRoles: async (actor: Actor | undefined, userId: number, roles: unknown): Promise<AuthOutcome> => {
      const denial = requireAdmin(actor);
      if (denial) {
        return denial;
      }

      if (!adapters.setRoles) {
        return NOT_OFFERED;
      }

      if (!Array.isArray(roles) || roles.some(role => typeof role !== 'string')) {
        return refuse(400, 'Roles must be a list of names');
      }

      const names = roles as string[];

      if (!(await adapters.findById?.(userId))) {
        return refuse(404, 'No such account');
      }

      await adapters.setRoles(userId, names);
      record({ type: 'admin.roles-changed', userId, actorId: actor?.id, detail: { roles: names } });

      return { ok: true, body: { success: true, roles: names } };
    },

    remove: async (actor: Actor | undefined, userId: number): Promise<AuthOutcome> => {
      const denial = requireAdmin(actor, userId);
      if (denial) {
        return denial;
      }

      if (!adapters.deleteAccount) {
        return NOT_OFFERED;
      }

      if (!(await adapters.findById?.(userId))) {
        return refuse(404, 'No such account');
      }

      await adapters.deleteAccount(userId);
      record({ type: 'admin.account-deleted', userId, actorId: actor?.id });

      return { ok: true, body: { success: true } };
    },

    /**
     * A session AS somebody else, for support that has to see what they see.
     *
     * Three properties make it something a deployment can live with, and all three are deliberate:
     *
     * - **It says so.** The credential carries `act` (RFC 8693), so every request made with it can be told from
     *   one the account holder made — `Actor.impersonatedBy` is that claim, read back. A borrowed session that
     *   is indistinguishable from a real one turns an audit log into fiction.
     * - **It is short and cannot renew.** Fifteen minutes by default and no refresh token, so it expires rather
     *   than becoming a permanent second key to somebody's account.
     * - **It is off unless asked for**, behind its own permission — see `impersonationPermission`.
     *
     * The session is answered in the BODY and no cookie is written. Swapping the administrator's own session
     * cookie for this one would sign them out of the account they administer from, and getting back would mean
     * signing in again; whoever asked decides where to put a credential they were handed.
     *
     * One caveat a deployment has to know: a store that keeps a single session per account — no `session` table —
     * will overwrite the subject's own session with this one, signing them out. Anything with per-session rows,
     * which is what `createMysqlStore` builds, does not.
     */
    impersonate: async (
      actor: Actor | undefined,
      userId: number,
      carrier?: CredentialCarrier
    ): Promise<AuthOutcome> => {
      if (!capabilities.impersonation || !impersonationPermission || !adapters.findById) {
        return NOT_OFFERED;
      }

      const check = checkPermission(actor, impersonationPermission);
      if (!check.ok) {
        return refuse(check.status, check.error, check.status === 401 ? 'missing' : undefined);
      }

      if (!actor || userId === actor.id) {
        return refuse(400, 'You are already signed in as yourself');
      }

      const account = await adapters.findById(userId);
      if (!account) {
        return refuse(404, 'No such account');
      }

      // A suspended account cannot hold a session, and an administrator borrowing one would be the way around
      // that — which is exactly what a ban is for.
      if (!account.active) {
        return refuse(403, 'That account is not active');
      }

      const session = await issue(
        userId,
        { client: clientOf(carrier) },
        { actingAs: actor.id, ttlSeconds: LIFETIME.impersonation, renewable: false }
      );

      record({ type: 'admin.impersonated', userId, actorId: actor.id });

      return { ok: true, body: { ...(await grantBody(account, session)), impersonatedBy: actor.id } };
    }
  }
});
