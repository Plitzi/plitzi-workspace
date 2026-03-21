/* eslint-disable @typescript-eslint/no-dynamic-delete */

import { get, omit } from '@plitzi/plitzi-ui/helpers';
import { useCallback, use, useMemo } from 'react';

import { baseDefaultValue } from '@plitzi/sdk-shared';
import DataSourceContext from '@plitzi/sdk-shared/dataSource/DataSourceContext';

import useStyleBinding from './hooks/useStyleBinding';
import StyleInspectorContext from './StyleInspectorContext';

import type { SetValues } from './StyleInspectorContext';
import type { StyleHelperMetaData } from '../../StyleHelper';
import type { DisplayMode, Element, StyleCategory, StyleItem, StyleValue } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type StyleInspectorProviderProps = {
  children: ReactNode;
  selector?: StyleItem;
  styleSelector: string;
  element?: Element;
  inheritData: StyleHelperMetaData;
  displayMode: DisplayMode;
  onChange?: (path?: StyleCategory, values?: StyleItem['attributes'] | StyleValue) => void;
};

const StyleInspectorProvider = ({
  children,
  selector,
  styleSelector = 'base',
  element,
  inheritData,
  displayMode,
  onChange
}: StyleInspectorProviderProps) => {
  const bindingData = useStyleBinding({ element });
  const { useDataSource } = use(DataSourceContext);
  const { variables: schemaVariables } = useDataSource<Record<string, unknown>>({ id: '', mode: 'read' });

  const setValue = useCallback(
    (styleKey?: StyleCategory, values?: StyleItem['attributes'] | StyleValue): void => {
      if (
        (styleKey && typeof values !== 'string' && typeof values !== 'number' && typeof values !== 'undefined') ||
        (!styleKey && typeof values !== 'object' && typeof values !== 'undefined') ||
        (styleKey && get(bindingData, styleKey))
      ) {
        return;
      }

      if (!styleKey && values && typeof values === 'object') {
        values = omit(values, Object.keys(bindingData));
      }

      if (!styleKey && selector && typeof values === 'object') {
        const currentValues =
          selector.type !== 'class-component' ? selector.attributes : selector.attributes[styleSelector];
        const newValues = { ...currentValues, ...values } as Partial<Record<StyleCategory, StyleValue>>;
        (Object.keys(newValues) as StyleCategory[]).forEach(k => {
          if (newValues[k] === undefined) {
            delete newValues[k];
          }
        });

        values = selector.type !== 'class-component' ? newValues : { ...values, [styleSelector]: newValues };
      }

      if (!styleKey && values && typeof values === 'object' && !Object.keys(values).length) {
        return;
      }

      onChange?.(styleKey, values);
    },
    [bindingData, onChange, selector, styleSelector]
  ) as SetValues;

  const getDefaultValue = useCallback(
    (key?: StyleCategory[] | StyleCategory): StyleValue | Record<StyleCategory, StyleValue> => {
      if (Array.isArray(key)) {
        return key.reduce((acum, key) => ({ ...acum, [key]: get(baseDefaultValue, key) }), {}) as Record<
          string,
          StyleValue
        >;
      }

      if (!key) {
        return baseDefaultValue;
      }

      return get(baseDefaultValue, key);
    },
    []
  );

  const resetValue = useCallback(
    (keys: StyleCategory | StyleCategory[]) => {
      if (Array.isArray(keys)) {
        setValue(
          undefined,
          keys.reduce((acum, key) => ({ ...acum, [key]: undefined }), {})
        );
      } else {
        setValue(keys);
      }
    },
    [setValue]
  );

  const inspectorContextValue = useMemo(
    () => ({
      selector,
      displayMode,
      variables: schemaVariables, // @todo: styleVariables (at global level) and selector?.variables (needs to be parsed in key:value)
      inheritData: inheritData.style,
      bindingData: bindingData,
      setValue,
      resetValue,
      getDefaultValue
    }),
    [schemaVariables, displayMode, selector, setValue, resetValue, inheritData, bindingData, getDefaultValue]
  );

  return <StyleInspectorContext value={inspectorContextValue}>{children}</StyleInspectorContext>;
};

export default StyleInspectorProvider;
