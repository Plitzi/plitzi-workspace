import type PathTrie from './PathTrie';
import type { Listener, StoreApi } from '../../types';

// Forwards parent changes to this scope's consumers: full-state listeners always wake, path listeners only when the
// parent's change can affect their path (`forEachAffected`). Consumer-level equality filters the rest. Returns the
// unsubscribe handle so the scope can detach on `destroy()`.
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
