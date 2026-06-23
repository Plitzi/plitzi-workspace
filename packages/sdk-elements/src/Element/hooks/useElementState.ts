import { get, omit } from '@plitzi/plitzi-ui/helpers';
import { useCallback, useMemo, useState } from 'react';

import type { Element } from '@plitzi/sdk-shared';

export type UseElementStateProps = { bindings?: Partial<Element['definition']['bindings']>; previewMode: boolean };

const useElementState = ({ bindings, previewMode }: UseElementStateProps) => {
  const [state, setState] = useState<Record<string, unknown>>({});
  const attributesBinded = useMemo(() => {
    const attributes = bindings?.attributes && Array.isArray(bindings.attributes) ? bindings.attributes : [];

    return attributes.filter(binding => binding.enabled !== false).map(binding => get(binding, 'toPath', ''));
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
        if (attributesBinded.length) {
          next = omit(next, attributesBinded) as T;
        }

        return next;
      });

      return true;
    },
    [attributesBinded, previewMode]
  );

  return { state, setElementState };
};

export default useElementState;
