import isPathAffected from '../../helpers/isPathAffected';

import type { Listener, Path, StoreApi } from '../../types';

// Subscribes this scope to its parent and forwards changes to local consumers, scoped by the changed path:
// full-state subscribers always wake (the merged snapshot changed), but a path listener only wakes if the
// parent's change can affect its path (or on a full-state replace, where `changedPath` is undefined).
// Consumer-level equality still filters the remaining no-ops (e.g. a path this scope shadows resolves to the
// same value). Returns the unsubscribe handle so the scope can detach on `destroy()`.
export function forwardParentChanges<TState extends object>(
  parent: StoreApi<TState>,
  listeners: Set<Listener>,
  pathListeners: Map<Path, Set<Listener>>,
  historyListeners: Set<Listener>
): () => void {
  return parent.subscribe(changedPath => {
    listeners.forEach(l => l(changedPath));
    pathListeners.forEach((set, candidate) => {
      if (changedPath && !isPathAffected(changedPath, candidate)) {
        return;
      }

      set.forEach(l => l(changedPath));
    });
    historyListeners.forEach(l => l(changedPath));
  });
}
