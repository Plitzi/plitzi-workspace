import { get, omit } from '@plitzi/plitzi-ui/helpers';
import { useCallback, useEffect, useMemo } from 'react';

import { useStoreById } from '@plitzi/nexus/react';
import { useCommonStore, useCommonStoreSetter } from '@plitzi/sdk-shared/store';

import type { PathOf } from '@plitzi/nexus';
import type { CommonState, Element } from '@plitzi/sdk-shared';

// Element state lives in the shared root store under `runtime.elements.<id>`, with a `scopePath` sub-key for
// duplicated instances (list rows) so two rows of the same element id never share a slice. No per-element store is
// created: reads/writes are a single path subscription on the nearest scope, which delegates the write up to the
// root that owns `runtime.elements` — keeping the state uniformly observable in devtools at floor cost. It is
// ephemeral: excluded from persist (only `runtime.state` is saved) and history; replica slices (list rows) are
// cleared on unmount, while a plain element's slice lives as long as its page (torn down with the store).
//
// Keyed by the element's id, which is the name a person can change — so RENAMING AN ELEMENT RESETS ITS STATE. The
// id is also the React key and the `data-rsc-id` that correlates the SSR and client renders, so a rename remounts
// the element anyway; moving the slice with it would only preserve what a remount already threw away. Accepted
// rather than worked around: it happens in the builder, to an element its author is editing right then.

const emptyState: Record<string, unknown> = {};

const elementStatePath = (id: string, scopePath: string | undefined): PathOf<CommonState> =>
  scopePath ? `runtime.elements.${id}.${scopePath}` : `runtime.elements.${id}`;

export type UseElementStateProps = {
  id: string;
  bindings?: Partial<Element['definition']['bindings']>;
  previewMode: boolean;
};

const useElementState = ({ id, bindings, previewMode }: UseElementStateProps) => {
  // The nearest scope's position-derived identity: '' for a plain element (a single instance), or a per-row path for
  // a list replica, so duplicated element ids resolve to distinct slices.
  const { scopePath } = useStoreById<CommonState>();
  const path = useMemo(() => elementStatePath(id, scopePath), [id, scopePath]);
  const [stateValue] = useCommonStore(path);
  const state = (stateValue as Record<string, unknown> | undefined) ?? emptyState;
  const setState = useCommonStoreSetter();

  const attributesBinded = useMemo(() => {
    const attributes = bindings?.attributes && Array.isArray(bindings.attributes) ? bindings.attributes : [];

    return attributes.filter(binding => binding.enabled !== false).map(binding => get(binding, 'to', ''));
  }, [bindings]);

  const setElementState = useCallback(
    <T extends Record<string, unknown> = Record<string, unknown>>(value?: T | ((prev: T) => T)) => {
      if (!previewMode) {
        return false;
      }

      const computeNext = (prev: Record<string, unknown> | undefined) => {
        if (!value) {
          return {};
        }

        let next = typeof value === 'function' ? value((prev ?? emptyState) as T) : value;
        if (attributesBinded.length) {
          next = omit(next, attributesBinded) as T;
        }

        return next;
      };

      setState(path, computeNext);

      return true;
    },
    [attributesBinded, path, previewMode, setState]
  );

  // Only replicas (a non-empty `scopePath` — e.g. list rows) churn through many short-lived slices, so only they clear
  // theirs on unmount to keep the shared store from accumulating stale entries. A plain element lives as long as its
  // page, so it skips the effect entirely and stays at the no-store floor.
  useEffect(() => {
    if (!previewMode || !scopePath) {
      return undefined;
    }

    return () => setState(path, undefined);
  }, [previewMode, scopePath, path, setState, id]);

  return { state, setElementState };
};

export default useElementState;
