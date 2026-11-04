import { get, omit } from '@plitzi/plitzi-ui/helpers';
import { useEffect } from 'react';

import { useDrawnCallback, useDrawnMemo } from './drawnMemo';

import type { PathOf, StoreApi } from '@plitzi/nexus';
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

export const emptyState: Record<string, unknown> = {};

/** Where an element's state is: its slice of `runtime.elements`, under its row's `scopePath` when it is a replica. */
export const elementStatePath = (id: string, scopePath: string | undefined): PathOf<CommonState> =>
  scopePath ? `runtime.elements.${id}.${scopePath}` : `runtime.elements.${id}`;

export type UseElementStateSetterProps = {
  /** The nearest scope's store: what the element reads its state from (`elementStatePath`), and writes it through. */
  store: StoreApi<CommonState>;
  id: string;
  bindings?: Partial<Element['definition']['bindings']>;
  previewMode: boolean;
};

/**
 * How an element writes its state, and where it is. The state itself is read with the element's other values in one
 * subscription (`useElementInternal`): read here, it was a subscription of its own on every element.
 */
const useElementStateSetter = ({ store, id, bindings, previewMode }: UseElementStateSetterProps) => {
  // The nearest scope's position-derived identity: '' for a plain element (a single instance), or a per-row path for
  // a list replica, so duplicated element ids resolve to distinct slices.
  const { scopePath } = store;
  const path = useDrawnMemo(() => elementStatePath(id, scopePath), [id, scopePath]);
  const setState = store.setState;

  const setElementState = useDrawnCallback(
    <T extends Record<string, unknown> = Record<string, unknown>>(value?: T | ((prev: T) => T)) => {
      if (!previewMode) {
        return false;
      }

      // What a binding writes is not the element's to set: worked out on a write, which few elements ever make, rather
      // than on every draw of every element.
      const boundAttributes = bindings?.attributes && Array.isArray(bindings.attributes) ? bindings.attributes : [];
      const attributesBinded = boundAttributes
        .filter(binding => binding.enabled !== false)
        .map(binding => get(binding, 'to', ''));

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
    [bindings, path, previewMode, setState]
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

  return { path, setElementState };
};

export default useElementStateSetter;
