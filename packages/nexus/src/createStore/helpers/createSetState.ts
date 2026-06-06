/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import { UNCHANGED, writeByPath } from './writeByPath';
import getByPath from '../../helpers/getByPath';
import parsePath from '../../helpers/parsePath';
import setByPath from '../../helpers/setByPath';
import { CANCEL } from '../../types';

import type PathTrie from './PathTrie';
import type Subscribers from './Subscribers';
import type {
  ChangeListener,
  Listener,
  PathOf,
  PathValue,
  SetState,
  StoreApi,
  StoreErrorReporter,
  WriteInterceptor
} from '../../types';

const NO_ERROR: unique symbol = Symbol('no-error');

// Runs every callback even if some throw (the `try` only re-enters on a throw, so the no-error path pays nothing) and
// returns the first error, or `NO_ERROR`, for the caller to route.
const runIsolated = <A>(items: ArrayLike<(arg: A) => void>, arg: A, count: number): unknown => {
  let i = 0;
  let error: unknown = NO_ERROR;
  while (i < count) {
    try {
      for (; i < count; i++) {
        items[i](arg);
      }
    } catch (err) {
      if (error === NO_ERROR) {
        error = err;
      }

      i++;
    }
  }

  return error;
};

// `obj['__proto__'] = x` hits the prototype setter rather than creating an own property, so a `__proto__` path segment
// would swap a state object's prototype and inject phantom keys.
const PROTO_KEY = '__proto__';

// Structural ownership: every segment exists as an own property locally, so an explicit `undefined` the child owns
// stays local while a path it never declared delegates to the parent.
const ownsPath = (state: object, segments: readonly string[]): boolean => {
  let current: unknown = state;
  for (let i = 0, n = segments.length; i < n; i++) {
    if (current === null || typeof current !== 'object' || !Object.hasOwn(current, segments[i])) {
      return false;
    }

    current = (current as Record<string, unknown>)[segments[i]];
  }

  return true;
};

export type SetStateDeps<TState extends object> = {
  getOwnState: () => TState;
  getOwnSnapshot: () => TState;
  setOwnState: (next: TState) => void;
  mutateOwnKey: (key: string, value: unknown) => void;
  parent: StoreApi<TState> | undefined;
  listeners: Subscribers<Listener>;
  changeListeners: Subscribers<ChangeListener<TState>>;
  pathListeners: PathTrie;
  interceptors: WriteInterceptor<TState>[];
  reportError: StoreErrorReporter<TState>;
  // Invalidate scoped descendants' cached reads after a silent (`canPropagate: false`) commit — those writes skip
  // subscriber wakes, so the change can't reach descendants through `notify`.
  invalidateDescendants: () => void;
  // Dev-only: a write this scope doesn't own is delegated to the parent. Reported so sibling scopes delegating the
  // same path can be flagged. Undefined in production.
  onDelegateToParent?: (path: string) => void;
};

export type SetStateApi<TState extends object> = {
  setState: SetState<TState>;
  batch: <R>(fn: () => R) => R;
};

export function createSetState<TState extends object>(deps: SetStateDeps<TState>): SetStateApi<TState> {
  const {
    getOwnState,
    getOwnSnapshot,
    setOwnState,
    mutateOwnKey,
    parent,
    listeners,
    pathListeners,
    changeListeners,
    interceptors,
    reportError,
    invalidateDescendants,
    onDelegateToParent
  } = deps;

  // Runs interceptors in order, each seeing the previous one's result. Returns the final value, or `CANCEL` if any
  // aborted; a thrown interceptor is reported and fails the write closed (its validation outcome is unknown).
  const runInterceptors = (path: PathOf<TState> | undefined, value: unknown, prev: unknown): unknown => {
    let current = value;
    for (let i = 0, n = interceptors.length; i < n; i++) {
      let result: unknown;
      try {
        result = interceptors[i]({ path, value: current, prev });
      } catch (err) {
        reportError(err, 'beforeChange', path);

        return CANCEL;
      }

      if (result === CANCEL) {
        return CANCEL;
      }

      if (result !== undefined) {
        current = result;
      }
    }

    return current;
  };

  // Inside `batch(fn)` writes still apply immediately (reads see them), but listener wakes are buffered here and
  // fired once at the end, deduplicated — so N writes touching the same subscriber re-render it once. The single
  // `batchDepth` check per `notify` keeps the un-batched hot path free.
  let batchDepth = 0;
  const pendingListeners = new Set<Listener>();

  const notify = (subs: Subscribers<Listener>, path: string | undefined): void => {
    const { items } = subs;
    if (batchDepth > 0) {
      for (let i = 0, n = items.length; i < n; i++) {
        pendingListeners.add(items[i]);
      }

      return;
    }

    // `begin`/`end` keep a listener that unsubscribes mid-notify safe (tombstone + compact) without copying the array.
    subs.begin();
    try {
      const err = runIsolated(items, path, items.length);
      if (err !== NO_ERROR) {
        reportError(err, 'notify', path as PathOf<TState> | undefined);
      }
    } finally {
      subs.end();
    }
  };

  const batch = <R>(fn: () => R): R => {
    batchDepth++;
    try {
      return fn();
    } finally {
      batchDepth--;
      if (batchDepth === 0 && pendingListeners.size > 0) {
        const woken = [...pendingListeners];
        pendingListeners.clear();
        const err = runIsolated(woken, undefined, woken.length);
        if (err !== NO_ERROR) {
          reportError(err, 'notify', undefined);
        }
      }
    }
  };

  const emitChange = (path: PathOf<TState> | undefined, prev: TState, next: TState): void => {
    const change = { path, prev, next };
    const { items } = changeListeners;
    changeListeners.begin();
    try {
      const err = runIsolated(items, change, items.length);
      if (err !== NO_ERROR) {
        reportError(err, 'onChange', path);
      }
    } finally {
      changeListeners.end();
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
    let resolvedValue: unknown = path
      ? typeof value === 'function'
        ? (value as (prev: PathValue<TState, P>) => PathValue<TState, P>)(prevValue as PathValue<TState, P>)
        : value
      : undefined;

    if (path && interceptors.length > 0) {
      const intercepted = runInterceptors(path, resolvedValue, prevValue);
      if (intercepted === CANCEL) {
        return;
      }

      resolvedValue = intercepted;
    }

    if (path && prevValue === resolvedValue) {
      return;
    }

    let nextState: TState = path
      ? setByPath(prevState, path, resolvedValue as PathValue<TState, P>)
      : typeof value === 'function'
        ? (value as (prev: TState) => TState)(prevState)
        : { ...prevState, ...value };

    // A whole-state write (`path === undefined`) intercepts the full next state, so a permission/validation
    // middleware can reject or replace the entire replacement.
    if (!path && interceptors.length > 0) {
      const intercepted = runInterceptors(undefined, nextState, prevState);
      if (intercepted === CANCEL) {
        return;
      }

      nextState = intercepted as TState;
    }

    if (nextState === prevState) {
      return;
    }

    setOwnState(nextState);
    if (changeListeners.length > 0) {
      emitChange(path, prevState, nextState);
    }

    if (!canPropagate) {
      invalidateDescendants();

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

    // Reject prototype-pollution paths before any write. The cheap substring gate keeps normal paths a single scan.
    if (typeof path === 'string' && path.indexOf(PROTO_KEY) !== -1 && parsePath(path).indexOf(PROTO_KEY) !== -1) {
      throw new Error(`@plitzi/nexus: refused to write to unsafe path "${path}" (\`__proto__\` segment)`);
    }

    // A scope that doesn't structurally own the path delegates to the parent — so an explicit `undefined` on a key the
    // child owns stays local instead of leaking upward.
    if (parent && typeof path === 'string') {
      const dot = path.indexOf('.');
      const owns = dot === -1 ? Object.hasOwn(prevState, path) : ownsPath(prevState, parsePath(path));
      if (!owns) {
        onDelegateToParent?.(path);
        parent.setState(path, value as PathValue<TState, P>, canPropagate);

        return;
      }
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
      const resolvedValue: unknown =
        typeof value === 'function'
          ? (value as (prev: PathValue<TState, P>) => PathValue<TState, P>)(prevValue as PathValue<TState, P>)
          : value;

      let finalValue = resolvedValue;
      if (interceptors.length > 0) {
        const intercepted = runInterceptors(path, resolvedValue, prevValue);
        if (intercepted === CANCEL) {
          return;
        }

        finalValue = intercepted;
      }

      if (prevValue === finalValue) {
        return;
      }

      const prevSnapshot = changeListeners.length > 0 ? getOwnSnapshot() : undefined;
      mutateOwnKey(path, finalValue);
      if (prevSnapshot !== undefined) {
        emitChange(path, prevSnapshot, getOwnSnapshot());
      }

      if (canPropagate) {
        notify(listeners, path);
        const exact = pathListeners.direct.get(path);
        if (exact) {
          notify(exact, path);
        }

        wakeChangedDescendants(path, prevValue, finalValue, path.length + 1);
      } else {
        invalidateDescendants();
      }

      return;
    }

    // Multi-segment: immutable structural-sharing write that shares untouched subtrees.
    const segments = parsePath(path);
    let result: TState | typeof UNCHANGED;
    if (interceptors.length > 0) {
      // Resolve the leaf up front so interceptors see a concrete value, then write the (possibly transformed) result
      // as a plain value rather than re-running a setter function.
      const prevValue: unknown = getByPath(prevState, path);
      const resolvedValue: unknown =
        typeof value === 'function'
          ? (value as (prev: PathValue<TState, P>) => PathValue<TState, P>)(prevValue as PathValue<TState, P>)
          : value;
      const intercepted = runInterceptors(path, resolvedValue, prevValue);
      if (intercepted === CANCEL) {
        return;
      }

      result = writeByPath(prevState, path, segments, intercepted, false) as TState | typeof UNCHANGED;
    } else {
      result = writeByPath(prevState, path, segments, value, typeof value === 'function') as TState | typeof UNCHANGED;
    }

    if (result === UNCHANGED) {
      return;
    }

    const nextState = result;
    setOwnState(nextState);
    if (changeListeners.length > 0) {
      emitChange(path, prevState, nextState);
    }

    if (canPropagate) {
      notify(listeners, path);
      wakeAncestors(path, segments);
      wakeChangedDescendants(path, prevState, nextState, 0);
    } else {
      invalidateDescendants();
    }
  };

  return { setState, batch };
}
