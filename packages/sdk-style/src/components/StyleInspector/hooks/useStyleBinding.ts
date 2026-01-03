import get from 'lodash-es/get';
import set from 'lodash-es/set';
import { useMemo } from 'react';

import useDataSource from '@plitzi/sdk-shared/dataSource/hooks/useDataSource';

import type { Element, ElementBinding, StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type UseStyleBindingProps = { element?: Element };

const useStyleBinding = ({ element }: UseStyleBindingProps) => {
  const dataSource = useDataSource<Record<string, unknown>>({ id: '', mode: 'read' });
  const attributes = useMemo(() => {
    const metadata: Partial<Record<StyleCategory, StyleValue>> = {};
    if (!element) {
      return metadata;
    }

    const {
      definition: { bindings }
    } = element;

    if (!bindings || !(bindings as Partial<Record<string, ElementBinding[]>>).style) {
      return metadata;
    }

    bindings.style.forEach(binding => {
      const value = get(dataSource, `${binding.source}.${binding.fromPath}`, undefined);
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
