import { get, omit } from '@plitzi/plitzi-ui/helpers';
import { useCallback, useMemo, useState } from 'react';

import { useStore, useStoreSetter } from '@plitzi/nexus/react';

import type { CommonState, Element } from '@plitzi/sdk-shared';

// Element state is gated: only `scoped` elements (those that can change state at runtime — see `withElement`) get a
// nexus-backed slice so devtools/history can see it; the rest keep cheap local `useState`. Both backings are wired
// unconditionally (rules of hooks) but the nexus subscription is disabled when not scoped, so the non-scoped path
// stays at the `useState` floor. The scoped slice is a top-level `state` key, private to the element (owned
// exclusively), NOT part of `CommonState` (global app state is `runtime.state`). Same public shape either way.

type ElementScopeState = CommonState & { state?: Record<string, unknown> };

const emptyState: Record<string, unknown> = {};

export type UseElementStateProps = {
  bindings?: Partial<Element['definition']['bindings']>;
  previewMode: boolean;
  scoped: boolean;
};

const useElementState = ({ bindings, previewMode, scoped }: UseElementStateProps) => {
  const [localState, setLocalState] = useState<Record<string, unknown>>(emptyState);
  const [scopedState = emptyState] = useStore<ElementScopeState, 'state'>('state', { enabled: scoped });
  const setScoped = useStoreSetter<ElementScopeState>();
  const state = scoped ? scopedState : localState;
  const attributesBinded = useMemo(() => {
    const attributes = bindings?.attributes && Array.isArray(bindings.attributes) ? bindings.attributes : [];

    return attributes.filter(binding => binding.enabled !== false).map(binding => get(binding, 'toPath', ''));
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

      if (scoped) {
        setScoped('state', computeNext);
      } else {
        setLocalState(computeNext);
      }

      return true;
    },
    [attributesBinded, previewMode, scoped, setScoped]
  );

  return { state, setElementState };
};

export default useElementState;
