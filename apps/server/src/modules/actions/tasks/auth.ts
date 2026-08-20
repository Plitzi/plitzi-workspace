import type { ActionTask } from '../types';

/**
 * Who the request carries.
 *
 * Projected, never passed through: `SSRUser` holds the visitor's `token`, and a flow that could read it could
 * also `flow.return` it or post it to a third party. Identity is what an action needs; the credential is not.
 */
const currentUser: ActionTask<Record<string, never>> = {
  namespace: 'auth',
  action: 'currentUser',
  title: 'Current User',
  params: {},
  run: (_params, ctx) => {
    const { user } = ctx;
    if (!user) {
      return { signedIn: false };
    }

    const { id, username, email, verified, permissions, roles } = user;

    return { signedIn: true, id, username, email, verified, permissions, roles };
  }
};

/**
 * Ends the run unless the caller holds every listed permission.
 *
 * The document's `access` already gates invocation; this is for the step in the middle — an action anyone may
 * call to read a quote, whose approval branch only a manager may reach.
 */
const requireRole: ActionTask<{ permissions: string }> = {
  namespace: 'auth',
  action: 'requireRole',
  title: 'Require Permissions',
  params: {
    permissions: { type: 'text', canBind: true, defaultValue: '', label: 'Permissions (comma separated)' }
  },
  run: ({ permissions }, ctx) => {
    const required = permissions
      .split(',')
      .map(permission => permission.trim())
      .filter(Boolean);
    if (required.length === 0) {
      throw new Error('No permissions declared to require');
    }

    const held = new Set(ctx.user?.permissions ?? []);
    const missing = required.filter(permission => !held.has(permission));
    if (missing.length > 0) {
      // The names are the author's own, not the visitor's data, so naming them in the trace is safe and is the
      // only way an author can tell "not signed in" from "signed in without this permission".
      throw new Error(`Missing permissions: ${missing.join(', ')}`);
    }

    return { granted: required };
  }
};

export const authTasks = [currentUser, requireRole] as ActionTask<Record<string, unknown>>[];
