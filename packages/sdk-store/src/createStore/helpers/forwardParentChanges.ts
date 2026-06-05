import type PathTrie from './PathTrie';
import type Subscribers from './Subscribers';
import type { ChangeListener, GetState, Listener, PathOf, StoreApi } from '../../types';

// Forwards parent changes to this scope's consumers: full-state listeners always wake, path listeners only when the
// parent's change can affect their path (`forEachAffected`), and change listeners (logger/history/persist) see it as
// a change of this scope's merged state. Consumer-level equality filters the rest. Returns the unsubscribe handle so
// the scope can detach on `destroy()`.
export function forwardParentChanges<TState extends object>(
  parent: StoreApi<TState>,
  listeners: Subscribers<Listener>,
  pathListeners: PathTrie,
  changeListeners: Subscribers<ChangeListener<TState>>,
  getState: GetState<TState>
): () => void {
  return parent.subscribe(changedPath => {
    listeners.forEach(listener => listener(changedPath));

    if (pathListeners.size > 0) {
      pathListeners.forEachAffected(changedPath, listener => listener(changedPath));
    }

    if (changeListeners.length > 0) {
      const merged = getState();
      const change = { path: changedPath as PathOf<TState> | undefined, prev: merged, next: merged };
      changeListeners.forEach(listener => listener(change));
    }
  });
}
