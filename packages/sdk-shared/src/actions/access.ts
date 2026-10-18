import { isRecord } from '../helpers/isRecord';

import type { ActionAccess } from '../types/ActionTypes';

/** Who is asking, as far as access is concerned: whether they are signed in, and what they may do. */
export type AccessCaller = { permissions: readonly string[] } | undefined;

/**
 * Why a caller may not use something guarded by `access`, or `undefined` when they may.
 *
 * One reading of the access vocabulary for everything that speaks it — an action's trigger, a realtime channel — so
 * `session` and `role` cannot come to mean two things in two places.
 */
export const accessRefusal = (
  access: ActionAccess | undefined,
  caller: AccessCaller
): 'unauthenticated' | 'forbidden' | undefined => {
  if (!access) {
    return 'forbidden';
  }

  if (access.mode === 'public') {
    return undefined;
  }

  if (!caller) {
    return 'unauthenticated';
  }

  if (access.mode === 'role') {
    const held = new Set(caller.permissions);

    return access.permissions.every(permission => held.has(permission)) ? undefined : 'forbidden';
  }

  return undefined;
};

/**
 * A value as access, when it is one — `{ mode: 'public' }`, `{ mode: 'session' }`, `{ mode: 'role', permissions }` with
 * at least one permission — rebuilt field by field, or `undefined`: what a job's `watch` is read with wherever it is.
 */
export const actionAccessOf = (value: unknown): ActionAccess | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  if (value.mode === 'public' || value.mode === 'session') {
    return { mode: value.mode };
  }

  const permissions = value.permissions;
  if (
    value.mode === 'role' &&
    Array.isArray(permissions) &&
    permissions.length > 0 &&
    permissions.every(permission => typeof permission === 'string' && permission !== '')
  ) {
    return { mode: 'role', permissions: permissions.filter((each): each is string => typeof each === 'string') };
  }

  return undefined;
};
