import getByPath from '../../helpers/getByPath';
import isPathAffected from '../../helpers/isPathAffected';
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
function notifyChange<TState extends object>(
  path: Path | undefined,
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
  pathListeners.forEach((set, candidate) => {
    if (path && !isPathAffected(path, candidate)) {
      return;
    }

    const prev = getByPath(prevState, candidate as PathOf<TState>);
    const next = getByPath(nextState, candidate as PathOf<TState>);
    if (!Object.is(prev, next)) {
      set.forEach(l => l(path));
    }
  });
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
    notifyChange(path, prevState, nextState, listeners, pathListeners, historyListeners, canPropagate);
  };

  return setState;
}
