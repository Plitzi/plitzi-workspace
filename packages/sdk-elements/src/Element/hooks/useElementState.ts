import get from 'lodash-es/get';
import omit from 'lodash-es/omit';
import { useCallback, useMemo, useState } from 'react';

import type { Element } from '@plitzi/sdk-shared';

export type UseElementStateProps = { bindings?: Partial<Element['definition']['bindings']>; previewMode: boolean };

const useElementState = ({ bindings, previewMode }: UseElementStateProps) => {
  const [state, setState] = useState<Record<string, unknown>>({});
  const cache = useMemo(() => {
    const initialState = bindings?.initialState && Array.isArray(bindings.initialState) ? bindings.initialState : [];
    const attributes = bindings?.attributes && Array.isArray(bindings.attributes) ? bindings.attributes : [];

    return {
      stateBinded: initialState.map(binding => get(binding, 'toPath', '')),
      attributesBinded: attributes.map(binding => get(binding, 'toPath', ''))
    };
  }, [bindings]);

  const setElementState = useCallback(
    <T extends Record<string, unknown> = Record<string, unknown>>(value?: T | ((prev: T) => T)) => {
      if (!previewMode) {
        return false;
      }

      setState(prev => {
        if (!value) {
          return {};
        }

        let next = typeof value === 'function' ? value(prev as T) : value;
        if (cache.attributesBinded.length) {
          next = omit(next, cache.attributesBinded) as T;
        }

        return next;
      });

      return true;
    },
    [cache, previewMode]
  );

  return { state, setState, setElementState };
};

export default useElementState;
