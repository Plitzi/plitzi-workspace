import getByPath from '../../helpers/getByPath';
import parsePath from '../../helpers/parsePath';
import setByPath from '../../helpers/setByPath';

import type { Listener, Path, PathOf, PathValue, SetState, StoreApi, StoreLogger } from '../../types';

export type SetStateDeps<TState extends object> = {
  getOwnState: () => TState;
  setOwnState: (next: TState) => void;
  parent: StoreApi<TState> | undefined;
  listeners: Set<Listener>;
  historyListeners?: Set<Listener>;
  pathListeners: Map<Path, Set<Listener>>;
  logger?: StoreLogger<TState>;
};

// Wakes subscribers after a local write: full-state listeners always; a path listener only if the changed path
// can affect it AND its resolved value actually changed.
//
// For a known changed `path` the affected subscribers are resolved by direct lookup instead of scanning every
// registered path: the changed path itself and each of its ancestors (whose containing object's identity changed
// via the immutable write) are O(depth) Map gets, and descendants are scanned only when the new value is a
// container that could hold them. This keeps an update O(depth) for the common leaf write rather than O(subscribers).
function notifyChange<TState extends object>(
  path: Path | undefined,
  newValue: unknown,
  prevState: TState,
  nextState: TState,
  listeners: Set<Listener>,
  pathListeners: Map<Path, Set<Listener>>,
  historyListeners: Set<Listener> | undefined,
  canPropagate: boolean
): void {
  historyListeners?.forEach(l => l(path));
  if (!canPropagate) {
    return;
  }

  listeners.forEach(l => l(path));

  if (pathListeners.size === 0) {
    return;
  }

  // Full-state replace (undefined) or an exotic non-string path: any registered path may have changed, so fall
  // back to checking each against the new state.
  if (typeof path !== 'string') {
    pathListeners.forEach((set, candidate) => {
      const prev = getByPath(prevState, candidate as PathOf<TState>);
      const next = getByPath(nextState, candidate as PathOf<TState>);
      if (!Object.is(prev, next)) {
        set.forEach(l => l(path));
      }
    });

    return;
  }

  // Exact path + ancestors: their value (or containing object's identity) changed, so wake without re-checking.
  let prefix = '';
  for (const part of parsePath(path)) {
    prefix = prefix ? `${prefix}.${part}` : part;
    const set = pathListeners.get(prefix);
    if (set) {
      set.forEach(l => l(path));
    }
  }

  // Descendants only exist to wake when the new value (already resolved by the caller) is a container.
  if (typeof newValue === 'object' && newValue !== null) {
    const descendantPrefix = `${path}.`;
    pathListeners.forEach((set, candidate) => {
      if (!candidate.startsWith(descendantPrefix)) {
        return;
      }

      const prev = getByPath(prevState, candidate as PathOf<TState>);
      const next = getByPath(nextState, candidate as PathOf<TState>);
      if (!Object.is(prev, next)) {
        set.forEach(l => l(path));
      }
    });
  }
}

// Builds `setState`: resolves the value, writes immutably, and notifies. Writes target the nearest scope that
// owns the exact path; otherwise they delegate up the chain (reaching the root for shared/global paths). Scoped
// values are seeded as own state via StoreProvider, not setState.
export function createSetState<TState extends object>(deps: SetStateDeps<TState>): SetState<TState> {
  const { getOwnState, setOwnState, parent, listeners, pathListeners, historyListeners, logger } = deps;

  const setState: SetState<TState> = <P extends PathOf<TState>>(
    path: P | undefined,
    value:
      | PathValue<TState, P>
      | ((prev: PathValue<TState, P>) => PathValue<TState, P>)
      | TState
      | ((prev: TState) => TState),
    canPropagate: boolean = true
  ) => {
    const prevState = getOwnState();

    if (path && parent && getByPath(prevState, path) === undefined) {
      parent.setState(path, value as PathValue<TState, P>, canPropagate);

      return;
    }

    const resolvedValue = path
      ? typeof value === 'function'
        ? (value as (prev: PathValue<TState, P>) => PathValue<TState, P>)(
            getByPath(prevState, path) as PathValue<TState, P>
          )
        : value
      : undefined;

    if (path && Object.is(getByPath(prevState, path), resolvedValue)) {
      return;
    }

    const nextState: TState = path
      ? setByPath(prevState, path, resolvedValue)
      : typeof value === 'function'
        ? (value as (prev: TState) => TState)(prevState)
        : { ...prevState, ...value };

    if (Object.is(nextState, prevState)) {
      return;
    }

    setOwnState(nextState);
    logger?.({ path, prev: prevState, next: nextState });
    notifyChange(path, resolvedValue, prevState, nextState, listeners, pathListeners, historyListeners, canPropagate);
  };

  return setState;
}
