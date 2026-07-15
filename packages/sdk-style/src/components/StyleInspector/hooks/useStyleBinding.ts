import { get, set } from '@plitzi/plitzi-ui/helpers';
import { useMemo } from 'react';

import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import type { Element, StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type UseStyleBindingProps = { element?: Element };

const useStyleBinding = ({ element }: UseStyleBindingProps) => {
  const [dataSource = emptyObject] = useCommonStore('runtime.sources');
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
      const value = get(dataSource, binding.source);
      if (value === undefined || !binding.enabled) {
        return;
      }

      set(metadata, binding.to, get(dataSource, binding.source));
    });

    return metadata;
  }, [dataSource, element]);

  return attributes;
};

export default useStyleBinding;
