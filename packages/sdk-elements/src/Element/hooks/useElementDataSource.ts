import { useMemo } from 'react';

import { createStoreHook } from '@plitzi/nexus/createStore';

import type { CommonState, ElementBinding } from '@plitzi/sdk-shared';

export type UseElementDataSourceProps = {
  bindings?: Record<string, ElementBinding[]>;
  sources?: string[];
};

// Source VALUES live under `runtime.sources.*` (globals + scoped), combined by the store's deep-merge scope
// chain. We subscribe only to the sources the element's bindings reference, so the element re-renders only when
// one of its own sources changes — not on unrelated source updates.
const useElementDataSource = ({ bindings, sources: sourcesProp }: UseElementDataSourceProps) => {
  const sourceNames = useMemo(() => {
    const names = new Set<string>(sourcesProp ?? []);
    for (const bindingsGroup of Object.values(bindings ?? {})) {
      if (!Array.isArray(bindingsGroup)) {
        continue;
      }

      for (const { source } of bindingsGroup) {
        if (source) {
          names.add(source);
        }
      }
    }

    if (names.size > 0 && !names.has('variables')) {
      names.add('variables');
    }

    return [...names];
  }, [bindings, sourcesProp]);

  const paths = useMemo(() => sourceNames.map(name => `runtime.sources.${name}` as const), [sourceNames]);
  const { useStore } = createStoreHook<CommonState>();
  const [values] = useStore(paths);

  return useMemo(() => {
    const map: Record<string, unknown> = {};
    sourceNames.forEach((name, index) => {
      map[name] = values[index];
    });

    return map;
  }, [sourceNames, values]);
};

export default useElementDataSource;
