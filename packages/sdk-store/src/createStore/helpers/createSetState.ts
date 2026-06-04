/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import { UNCHANGED, writeByPath, writeResult } from './writeByPath';
import getByPath from '../../helpers/getByPath';
import parsePath from '../../helpers/parsePath';
import setByPath from '../../helpers/setByPath';

import type PathTrie from './PathTrie';
import type { Listener, PathOf, PathValue, SetState, StoreApi, StoreLogger } from '../../types';

export type SetStateDeps<TState extends object> = {
  getOwnState: () => TState;
  getOwnSnapshot: () => TState;
  setOwnState: (next: TState) => void;
  mutateOwnKey: (key: string, value: unknown) => void;
  parent: StoreApi<TState> | undefined;
  listeners: Listener[];
  historyListeners?: Listener[];
  pathListeners: PathTrie;
  logger?: StoreLogger<TState>;
};

const notifyListeners = (arr: Listener[], path: string | undefined) => {
  for (let i = 0; i < arr.length; i++) {
    arr[i](path);
  }
};

export function createSetState<TState extends object>(deps: SetStateDeps<TState>): SetState<TState> {
  const {
    getOwnState,
    getOwnSnapshot,
    setOwnState,
    mutateOwnKey,
    parent,
    listeners,
    pathListeners,
    historyListeners,
    logger
  } = deps;

  // --- Cold path: fallback (non-string paths, plain-object merge) ---
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
    logger?.({ path, prev: prevState, next: nextState });

    if (historyListeners) {
      notifyListeners(historyListeners, path);
    }

    if (canPropagate) {
      for (let i = 0; i < listeners.length; i++) {
        listeners[i](path);
      }

      if (pathListeners.size > 0) {
        pathListeners.forEach((arr, candidate) => {
          const prev = getByPath(prevState, candidate as PathOf<TState>);
          const next = getByPath(nextState, candidate as PathOf<TState>);
          if (prev !== next) {
            for (let i = 0; i < arr.length; i++) {
              arr[i](path);
            }
          }
        });
      }
    }
  };

  // --- setState — dispatcher + hot paths inline (both single and multi-segment),
  //     so V8 can inline the whole thing into the benchmark loop ---
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

    if (parent && path) {
      const prevValue: unknown = getByPath(prevState, path);

      if (prevValue === undefined) {
        parent.setState(path, value as PathValue<TState, P>, canPropagate);

        return;
      }
    }

    if (typeof path === 'string') {
      if (path.indexOf('.') === -1) {
        // --- Single-segment hot path: mutate the live state in place (O(1), no top-level spread) ---
        const prevValue: unknown = (prevState as Record<string, unknown>)[path];
        const resolvedValue =
          typeof value === 'function'
            ? (value as (prev: PathValue<TState, P>) => PathValue<TState, P>)(prevValue as PathValue<TState, P>)
            : value;

        if (prevValue === resolvedValue) {
          return;
        }

        // The logger needs distinct prev/next snapshots; take the pre-mutation one before committing.
        const loggerPrev = logger ? getOwnSnapshot() : undefined;

        mutateOwnKey(path, resolvedValue);
        if (logger) {
          logger({ path, prev: loggerPrev as TState, next: getOwnSnapshot() });
        }

        if (historyListeners) {
          notifyListeners(historyListeners, path);
        }

        if (canPropagate) {
          for (let i = 0; i < listeners.length; i++) {
            listeners[i](path);
          }

          const arr = pathListeners.direct.get(path);
          if (arr) {
            for (let i = 0; i < arr.length; i++) {
              arr[i](path);
            }
          }

          if (typeof resolvedValue === 'object' && resolvedValue !== null) {
            const descendants = pathListeners.getDescendants(path);
            if (descendants) {
              const offset = path.length + 1;
              for (const descendant of descendants) {
                const arr = pathListeners.direct.get(descendant);
                if (arr) {
                  const relative = descendant.slice(offset);
                  const prev = getByPath(prevValue, relative as never);
                  const next = getByPath(resolvedValue, relative as never);
                  if (prev !== next) {
                    for (let i = 0; i < arr.length; i++) {
                      arr[i](path);
                    }
                  }
                }
              }
            }
          }
        }

        return;
      }

      // --- Multi-segment hot path (immutable structural-sharing write) ---
      const segments = parsePath(path);
      const result = writeByPath(prevState, path, segments, value, typeof value === 'function');
      if (result === UNCHANGED) {
        return;
      }

      const resolvedValue = writeResult.resolved;
      const nextState = result as TState;

      setOwnState(nextState);
      logger?.({ path, prev: prevState, next: nextState });

      if (historyListeners) {
        notifyListeners(historyListeners, path);
      }

      if (canPropagate) {
        for (let i = 0; i < listeners.length; i++) {
          listeners[i](path);
        }

        if (pathListeners.size > 0) {
          const prefixes = pathListeners.getPrefixes(path);
          if (prefixes) {
            for (let i = 0; i < prefixes.length; i++) {
              const arr = pathListeners.direct.get(prefixes[i]);
              if (arr) {
                for (let j = 0; j < arr.length; j++) {
                  arr[j](path);
                }
              }
            }
          }

          if (typeof resolvedValue === 'object' && resolvedValue !== null) {
            const descendants = pathListeners.getDescendants(path);
            if (descendants) {
              for (const descendant of descendants) {
                const arr = pathListeners.direct.get(descendant);
                if (arr) {
                  const prev = getByPath(prevState, descendant as PathOf<TState>);
                  const next = getByPath(nextState, descendant as PathOf<TState>);
                  if (prev !== next) {
                    for (let i = 0; i < arr.length; i++) {
                      arr[i](path);
                    }
                  }
                }
              }
            }
          }
        }
      }

      return;
    }

    handleFallback(path, value, prevState, canPropagate);
  };

  return setState;
}
