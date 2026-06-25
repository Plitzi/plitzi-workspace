import { get, omit } from '@plitzi/plitzi-ui/helpers';
import { useCallback, useMemo } from 'react';

import { useStore, useStoreSetter } from '@plitzi/nexus/react';

import type { CommonState, Element } from '@plitzi/sdk-shared';

// Element state lives in the per-element live scope `withElement` mounts: a top-level `state` key the scope owns
// exclusively, private to the element (NOT part of `CommonState` — global app state is `runtime.state`). Every
// element is scoped, so the state is uniformly nexus-backed (observable, reachable out-of-band) with no per-element
// gating to maintain.

type ElementScopeState = CommonState & { state?: Record<string, unknown> };

const emptyState: Record<string, unknown> = {};

export type UseElementStateProps = {
  bindings?: Partial<Element['definition']['bindings']>;
  previewMode: boolean;
};

const useElementState = ({ bindings, previewMode }: UseElementStateProps) => {
  const [state = emptyState] = useStore<ElementScopeState, 'state'>('state');
  const setScoped = useStoreSetter<ElementScopeState>();
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

      setScoped('state', computeNext);

      return true;
    },
    [attributesBinded, previewMode, setScoped]
  );

  return { state, setElementState };
};

export default useElementState;
