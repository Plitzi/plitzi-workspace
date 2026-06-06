import type PathTrie from './PathTrie';
import type Subscribers from './Subscribers';
import type { ChangeListener, GetState, Listener, PathOf, StoreErrorReporter, StoreApi } from '../../types';

// Forwards parent changes to this scope's consumers: full-state listeners always wake, path listeners only when the
// parent's change can affect them, and change listeners (logger/history/persist) see it as a change of this scope's
// merged state. A throwing consumer is routed to `reportError`, never starving the others.
export function forwardParentChanges<TState extends object>(
  parent: StoreApi<TState>,
  listeners: Subscribers<Listener>,
  pathListeners: PathTrie,
  changeListeners: Subscribers<ChangeListener<TState>>,
  getState: GetState<TState>,
  reportError: StoreErrorReporter<TState>,
  invalidate: () => void
): { unsubscribe: () => void; seedBaseline: () => void } {
  // The parent has already committed by the time a change forwards, so the pre-change merged state must be captured
  // beforehand. Seeding lazily (only once a change listener exists) keeps getPath-only scopes from ever materializing
  // the full merge; from there it rolls forward, giving listeners a real `prev` distinct from `next`.
  let prevMerged: TState | undefined;

  const seedBaseline = (): void => {
    prevMerged ??= getState();
  };

  const unsubscribe = parent.subscribe(changedPath => {
    // The parent (or an ancestor) committed: invalidate this scope's cached path reads before any listener — which
    // may read getPath — runs. The cascade reaches deeper scopes through this scope's own listeners below (each
    // child's forwarder is one of them), so a propagating change needs no extra downward signal.
    invalidate();

    const path = changedPath as PathOf<TState> | undefined;
    listeners.forEach(
      listener => listener(changedPath),
      err => reportError(err, 'notify', path)
    );

    if (pathListeners.size > 0) {
      pathListeners.forEachAffected(
        changedPath,
        listener => listener(changedPath),
        err => reportError(err, 'notify', path)
      );
    }

    if (changeListeners.length > 0) {
      const next = getState();
      const change = { path, prev: prevMerged ?? next, next };
      prevMerged = next;
      changeListeners.forEach(
        listener => listener(change),
        err => reportError(err, 'onChange', path)
      );
    }
  });

  return { unsubscribe, seedBaseline };
}
