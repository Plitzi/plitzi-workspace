/* eslint-disable @typescript-eslint/no-explicit-any */

import { isPlainObject } from '../createStore/helpers/deepMerge';
import getByPath from '../helpers/getByPath';
import isPathAffected from '../helpers/isPathAffected';

import type { Path, PathOf, StoreApi } from '../types';

export type HistoryEntry<TState> = {
  // The precise leaf path that changed for this entry; undefined for the initial snapshot or a full-state replace.
  path?: Path;
  // The new value at `path` after the change (for the action-log preview).
  value?: unknown;
  state: TState;
  timestamp: number;
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
  destroy: () => void;
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

// Records store snapshots for an action log + time-travel, riding the store's `subscribeChange` substrate (the same
// one logger and persist use). Time-travel restores a snapshot via a full-state replace. Note: it reliably restores
// state the store OWNS (e.g. builder edits); slices continuously re-synced from external sources via `useStoreSync`
// (e.g. `runtime.*`) reconcile to their live value on the next render.
export function createStoreHistory<TState extends object>(
  store: StoreApi<TState>,
  options: StoreHistoryOptions = {}
): StoreHistory<TState> {
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

  const unsubscribe = store.subscribeChange(({ path: changedPath }) => {
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

    // Producers sync whole slices (e.g. `useStoreSync('schema', …)`), so `changedPath` is coarse. Refine it to the
    // exact leaf that changed (and capture its new value) for a meaningful action log. Best-effort: the diff must
    // never break recording, so any failure (deep/odd state) falls back to the coarse path.
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
  });

  const travelTo = (target: number) => {
    if (target < 0 || target >= entries.length || target === index) {
      return;
    }

    const restored = entries[target].state;
    traveling = true;
    // Function form forces a replace (the object form would merge over the current state). When scoped to a
    // root path, restore only that subtree and leave the rest of the store as-is.
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

  return {
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
    },
    destroy: () => {
      unsubscribe();
      listeners.clear();
    }
  };
}

// One history per store instance, so every consumer (e.g. the devtools panel) shares the same recording and
// time-travel controls. Options are applied by the first caller.
const registry = new WeakMap<StoreApi<any>, StoreHistory<any>>();

export function getStoreHistory<TState extends object>(
  store: StoreApi<TState>,
  options?: StoreHistoryOptions
): StoreHistory<TState> {
  let history = registry.get(store) as StoreHistory<TState> | undefined;
  if (!history) {
    history = createStoreHistory(store, options);
    registry.set(store, history);
  }

  return history;
}
