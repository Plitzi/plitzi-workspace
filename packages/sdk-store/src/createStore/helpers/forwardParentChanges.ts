import type PathTrie from './PathTrie';
import type { Listener, StoreApi } from '../../types';

// Subscribes this scope to its parent and forwards changes to local consumers, scoped by the changed path:
// full-state subscribers always wake (the merged snapshot changed), but a path listener only wakes if the
// parent's change can affect its path (or on a full-state replace, where `changedPath` is undefined).
// Consumer-level equality still filters the remaining no-ops (e.g. a path this scope shadows resolves to the
// same value). Returns the unsubscribe handle so the scope can detach on `destroy()`.
export function forwardParentChanges<TState extends object>(
  parent: StoreApi<TState>,
  listeners: Listener[],
  pathListeners: PathTrie,
  historyListeners: Listener[]
): () => void {
  return parent.subscribe(changedPath => {
    for (let i = 0; i < listeners.length; i++) {
      listeners[i](changedPath);
    }

    if (pathListeners.size > 0) {
      pathListeners.forEachAffected(changedPath, listener => listener(changedPath));
    }

    for (let i = 0; i < historyListeners.length; i++) {
      historyListeners[i](changedPath);
    }
  });
}
