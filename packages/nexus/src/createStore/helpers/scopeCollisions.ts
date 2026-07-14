// Dev-only guard: sibling scopes (children of the same parent) are isolated for reads — each subtree sees only its
// own scope plus the chain — so two siblings *declaring* the same key never collide (the List pattern, where every
// row provider uses the same source key, relies on exactly that). The one real collision is a *delegated write*:
// when a scope writes a path it doesn't own, the write travels up to the shared parent, so two siblings writing the
// same unowned path clobber each other through it. This detects that and warns; it never changes behavior, and the
// whole module is compiled out of production builds (see the caller's MODE gate).

import { isTest } from '../../env';

export type ScopeClaims = { claimDelegatedWrite: (path: string, scopeId: number) => void };

const collisionMessage = (path: string) =>
  '@plitzi/nexus: scope collision — two sibling scopes under the same parent both delegate a write to ' +
  `"${path}", clobbering each other through the shared parent. Write to a path each scope owns, or move the ` +
  'shared value into the parent and update it there.';

// A registry held by a parent scope: each child registers the unowned paths it delegates up, tagged with its scope
// id, so a second child delegating the same path can be flagged.
export const createScopeClaims = (): ScopeClaims => {
  const writers = new Map<string, number>();

  return {
    claimDelegatedWrite(path, scopeId) {
      const existing = writers.get(path);
      if (existing !== undefined && existing !== scopeId) {
        if (isTest) {
          throw new Error(collisionMessage(path));
        }

        console.warn(collisionMessage(path));

        return;
      }

      writers.set(path, scopeId);
    }
  };
};
