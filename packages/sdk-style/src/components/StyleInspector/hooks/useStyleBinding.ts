import { get, set } from '@plitzi/plitzi-ui/helpers';
import { useMemo } from 'react';

import { createStoreHook } from '@plitzi/nexus/createStore';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';

import type { CommonState, Element, StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type UseStyleBindingProps = { element?: Element };

const useStyleBinding = ({ element }: UseStyleBindingProps) => {
  const { useStore } = createStoreHook<CommonState>();
  const [dataSource] = useStore('runtime.sources', { defaultValue: emptyObject });
  const attributes = useMemo(() => {
    const metadata: Partial<Record<StyleCategory, StyleValue>> = {};
    if (!element) {
      return metadata;
    }

    const {
      definition: { bindings }
    } = element;

    if (!bindings?.style) {
      return metadata;
    }

    bindings.style.forEach(binding => {
      const value = get(dataSource, `${binding.source}.${binding.fromPath}`);
      if (value === undefined || !binding.enabled) {
        return;
      }

      set(metadata, binding.toPath, get(dataSource, `${binding.source}.${binding.fromPath}`));
    });

    return metadata;
  }, [dataSource, element]);

  return attributes;
};

export default useStyleBinding;
