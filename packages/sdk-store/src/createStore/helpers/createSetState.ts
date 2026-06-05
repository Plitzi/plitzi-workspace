/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import { UNCHANGED, writeByPath } from './writeByPath';
import getByPath from '../../helpers/getByPath';
import parsePath from '../../helpers/parsePath';
import setByPath from '../../helpers/setByPath';

import type PathTrie from './PathTrie';
import type { ChangeListener, Listener, PathOf, PathValue, SetState, StoreApi } from '../../types';

export type SetStateDeps<TState extends object> = {
  getOwnState: () => TState;
  getOwnSnapshot: () => TState;
  setOwnState: (next: TState) => void;
  mutateOwnKey: (key: string, value: unknown) => void;
  parent: StoreApi<TState> | undefined;
  listeners: Listener[];
  changeListeners: ChangeListener<TState>[];
  pathListeners: PathTrie;
};

const notify = (arr: Listener[], path: string | undefined): void => {
  for (let i = 0; i < arr.length; i++) {
    arr[i](path);
  }
};

export function createSetState<TState extends object>(deps: SetStateDeps<TState>): SetState<TState> {
  const { getOwnState, getOwnSnapshot, setOwnState, mutateOwnKey, parent, listeners, pathListeners, changeListeners } =
    deps;

  const emitChange = (path: PathOf<TState> | undefined, prev: TState, next: TState): void => {
    for (let i = 0; i < changeListeners.length; i++) {
      changeListeners[i]({ path, prev, next });
    }
  };

  // Wakes listeners at `changedPath` and every ancestor: the write put a new reference at each level of the spine.
  const wakeAncestors = (changedPath: string, segments: readonly string[]): void => {
    let prefix = '';
    for (let i = 0; i < segments.length; i++) {
      prefix = prefix ? `${prefix}.${segments[i]}` : segments[i];
      const arr = pathListeners.direct.get(prefix);
      if (arr) {
        notify(arr, changedPath);
      }
    }
  };

  // Wakes listeners below `changedPath` whose own value actually changed, so a sibling edit doesn't wake them.
  // `relativeFrom` is where each descendant's path relative to `prevBase`/`nextBase` starts.
  const wakeChangedDescendants = (
    changedPath: string,
    prevBase: unknown,
    nextBase: unknown,
    relativeFrom: number
  ): void => {
    const descendants = pathListeners.getDescendants(changedPath);
    if (!descendants) {
      return;
    }

    for (const descendant of descendants) {
      const arr = pathListeners.direct.get(descendant);
      if (!arr) {
        continue;
      }

      const relative = descendant.slice(relativeFrom);
      if (getByPath(prevBase, relative as never) !== getByPath(nextBase, relative as never)) {
        notify(arr, changedPath);
      }
    }
  };

  // Cold path: non-string paths and whole-state merges. With no single changed path to walk, it wakes by diffing
  // every registered path.
  const handleFallback = <P extends PathOf<TState>>(
    path: P | undefined,
    value:
      | PathValue<TState, P>
      | ((prev: PathValue<TState, P>) => PathValue<TState, P>)
      | TState
      | ((prev: TState) => TState),
    prevState: TState,
    canPropagate: boolean
  ): void => {
    const prevValue: unknown = path ? getByPath(prevState, path) : undefined;
    const resolvedValue = path
      ? typeof value === 'function'
        ? (value as (prev: PathValue<TState, P>) => PathValue<TState, P>)(prevValue as PathValue<TState, P>)
        : value
      : undefined;

    if (path && prevValue === resolvedValue) {
      return;
    }

    const nextState: TState = path
      ? setByPath(prevState, path, resolvedValue)
      : typeof value === 'function'
        ? (value as (prev: TState) => TState)(prevState)
        : { ...prevState, ...value };

    if (nextState === prevState) {
      return;
    }

    setOwnState(nextState);
    if (changeListeners.length > 0) {
      emitChange(path, prevState, nextState);
    }

    if (!canPropagate) {
      return;
    }

    notify(listeners, path);

    if (pathListeners.size > 0) {
      pathListeners.direct.forEach((arr, candidate) => {
        if (getByPath(prevState, candidate as PathOf<TState>) !== getByPath(nextState, candidate as PathOf<TState>)) {
          notify(arr, path);
        }
      });
    }
  };

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

    // A nested scope that doesn't own the path delegates to the parent that does.
    if (parent && path && getByPath(prevState, path) === undefined) {
      parent.setState(path, value as PathValue<TState, P>, canPropagate);

      return;
    }

    if (typeof path !== 'string') {
      handleFallback(path, value, prevState, canPropagate);

      return;
    }

    const singleSegment = path.indexOf('.') === -1;

    if (singleSegment) {
      // Mutate the live state in place (O(1), no top-level spread). Safe: snapshots are distinct clones, and this
      // rebinds a key rather than mutating any object already handed out.
      const prevValue: unknown = (prevState as Record<string, unknown>)[path];
      const resolvedValue =
        typeof value === 'function'
          ? (value as (prev: PathValue<TState, P>) => PathValue<TState, P>)(prevValue as PathValue<TState, P>)
          : value;

      if (prevValue === resolvedValue) {
        return;
      }

      const prevSnapshot = changeListeners.length > 0 ? getOwnSnapshot() : undefined;
      mutateOwnKey(path, resolvedValue);
      if (prevSnapshot !== undefined) {
        emitChange(path, prevSnapshot, getOwnSnapshot());
      }

      if (canPropagate) {
        notify(listeners, path);
        const exact = pathListeners.direct.get(path);
        if (exact) {
          notify(exact, path);
        }

        wakeChangedDescendants(path, prevValue, resolvedValue, path.length + 1);
      }

      return;
    }

    // Multi-segment: immutable structural-sharing write that shares untouched subtrees.
    const segments = parsePath(path);
    const result = writeByPath(prevState, path, segments, value, typeof value === 'function');
    if (result === UNCHANGED) {
      return;
    }

    const nextState = result as TState;
    setOwnState(nextState);
    if (changeListeners.length > 0) {
      emitChange(path, prevState, nextState);
    }

    if (canPropagate) {
      notify(listeners, path);
      wakeAncestors(path, segments);
      wakeChangedDescendants(path, prevState, nextState, 0);
    }
  };

  return setState;
}
