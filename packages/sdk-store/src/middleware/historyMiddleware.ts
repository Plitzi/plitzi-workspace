/* eslint-disable @typescript-eslint/no-explicit-any */

import { isPlainObject } from '../createStore/helpers/deepMerge';
import getByPath from '../helpers/getByPath';
import isPathAffected from '../helpers/isPathAffected';

import type { ChangeListener, Path, PathOf, StoreApi, StoreMiddleware } from '../types';

export type HistoryEntry<TState> = {
  // The precise leaf path that changed for this entry; undefined for the initial snapshot or a full-state replace.
  path?: Path;
  // The new value at `path` after the change (for the action-log preview).
  value?: unknown;
  state: TState;
  timestamp: number;
};

export type HistorySnapshot<TState> = {
  entries: ReadonlyArray<HistoryEntry<TState>>;
  index: number;
  canUndo: boolean;
  canRedo: boolean;
};

export type StoreHistory<TState> = {
  getSnapshot: () => HistorySnapshot<TState>;
  subscribe: (listener: () => void) => () => void;
  undo: () => void;
  redo: () => void;
  travelTo: (index: number) => void;
  clear: () => void;
};

export type StoreHistoryOptions = {
  // Max entries kept (ring buffer, oldest dropped first). Default 100.
  limit?: number;
  // Scope the history to a subtree root (e.g. `'schema'`): only changes affecting it are recorded, and
  // time-travel restores only that subtree. Omit to track the whole store.
  path?: Path;
  // Return false to skip recording a change — e.g. high-frequency synced paths (`runtime.*`) that aren't user edits.
  shouldRecord?: (changedPath: Path | undefined) => boolean;
};

// Finds the deepest changed leaf between two values by walking and skipping reference-equal subtrees. Cheap and
// accurate when updates preserve structural sharing (e.g. immer / immutable setByPath), which the producers do.
const findChangedLeaf = (prev: unknown, next: unknown, depth = 12): { path: string; value: unknown } | undefined => {
  if (Object.is(prev, next)) {
    return undefined;
  }

  if (depth <= 0 || !isPlainObject(prev) || !isPlainObject(next)) {
    return { path: '', value: next };
  }

  for (const key of new Set([...Object.keys(prev), ...Object.keys(next)])) {
    if (Object.is(prev[key], next[key])) {
      continue;
    }

    const deeper = findChangedLeaf(prev[key], next[key], depth - 1);
    if (deeper) {
      return { path: deeper.path ? `${key}.${deeper.path}` : key, value: deeper.value };
    }
  }

  return undefined;
};

// The queryable handle plus the change-handler that feeds it. `record` is wired onto the middleware's `onChange`,
// so the recording rides the shared `subscribeChange` substrate (the same one logger and persist use). Time-travel
// restores via a full-state replace: reliable for state the store OWNS; slices re-synced from outside via
// `useStoreSync` reconcile to their live value on the next render.
function createHistoryRecorder<TState extends object>(
  store: StoreApi<TState>,
  options: StoreHistoryOptions = {}
): { handle: StoreHistory<TState>; record: ChangeListener<TState> } {
  const limit = options.limit ?? 100;
  const rootPath = options.path;
  const shouldRecord = options.shouldRecord;

  let entries: HistoryEntry<TState>[] = [{ state: store.getState(), timestamp: Date.now() }];
  let index = 0;
  let traveling = false;

  const buildSnapshot = (): HistorySnapshot<TState> => ({
    entries,
    index,
    canUndo: index > 0,
    canRedo: index < entries.length - 1
  });

  let snapshot = buildSnapshot();
  const listeners = new Set<() => void>();

  const emit = () => {
    snapshot = buildSnapshot();
    listeners.forEach(l => l());
  };

  const record: ChangeListener<TState> = ({ path: changedPath }) => {
    if (traveling || (shouldRecord && !shouldRecord(changedPath))) {
      return;
    }

    // Scoped history: only record changes that touch the tracked subtree (a full-state replace counts).
    if (rootPath && changedPath !== undefined && !isPathAffected(changedPath, rootPath)) {
      return;
    }

    // A new change after an undo discards the redo branch.
    const base = index < entries.length - 1 ? entries.slice(0, index + 1) : entries;
    const prevState = base[base.length - 1].state;
    const newState = store.getState();

    // `changedPath` can be coarse (a whole-slice sync). Refine it to the exact changed leaf for the action log;
    // best-effort, so any diff failure falls back to the coarse path rather than dropping the record.
    let path = changedPath ?? rootPath;
    let value: unknown;
    const diffPath = (changedPath ?? rootPath) as PathOf<TState> | undefined;
    if (diffPath) {
      try {
        const refined = findChangedLeaf(getByPath(prevState, diffPath), getByPath(newState, diffPath));
        if (refined) {
          path = refined.path ? `${diffPath}.${refined.path}` : diffPath;
          value = refined.value;
        }
      } catch {
        // keep the coarse path
      }
    }

    const next = [...base, { path, value, state: newState, timestamp: Date.now() }];
    entries = next.length > limit ? next.slice(next.length - limit) : next;
    index = entries.length - 1;
    emit();
  };

  const travelTo = (target: number) => {
    if (target < 0 || target >= entries.length || target === index) {
      return;
    }

    const restored = entries[target].state;
    traveling = true;
    // Function form forces a replace (object form would merge). Scoped history restores only its subtree.
    if (rootPath) {
      const subtree = getByPath(restored, rootPath as PathOf<TState>);
      store.setState(rootPath as PathOf<TState>, () => subtree as never);
    } else {
      store.setState(undefined, () => restored);
    }

    traveling = false;
    index = target;
    emit();
  };

  const handle: StoreHistory<TState> = {
    getSnapshot: () => snapshot,
    subscribe: listener => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    undo: () => travelTo(index - 1),
    redo: () => travelTo(index + 1),
    travelTo,
    clear: () => {
      entries = [{ state: store.getState(), timestamp: Date.now() }];
      index = 0;
      emit();
    }
  };

  return { handle, record };
}

// One history per store instance, registered by `historyMiddleware`, so every consumer (the hook, the devtools
// panel) shares the same recording and time-travel controls.
const registry = new WeakMap<StoreApi<any>, StoreHistory<any>>();

// Retrieves the history `historyMiddleware()` registered for this store, or `undefined` when none is enabled.
export function getStoreHistory<TState extends object>(store: StoreApi<TState>): StoreHistory<TState> | undefined {
  return registry.get(store) as StoreHistory<TState> | undefined;
}

// Records the action log / time-travel history from store creation. Recording rides the middleware's `onChange` (the
// shared `subscribeChange` substrate logger and persist use); the handle is registered so a devtools panel or
// `useStoreHistory` can retrieve it with `getStoreHistory(store)`. History is only recorded when this is added.
export const historyMiddleware = <TState extends object>(options?: StoreHistoryOptions): StoreMiddleware<TState> => {
  return api => {
    const { handle, record } = createHistoryRecorder(api, options);
    registry.set(api, handle);

    return { onChange: record };
  };
};
