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
