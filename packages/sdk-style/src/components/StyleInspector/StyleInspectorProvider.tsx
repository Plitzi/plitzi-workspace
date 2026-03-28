/* eslint-disable @typescript-eslint/no-dynamic-delete */

import { get, omit } from '@plitzi/plitzi-ui/helpers';
import { useCallback, use, useMemo } from 'react';

import { baseDefaultValue } from '@plitzi/sdk-shared';
import DataSourceContext from '@plitzi/sdk-shared/dataSource/DataSourceContext';

import useStyleBinding from './hooks/useStyleBinding';
import StyleInspectorContext from './StyleInspectorContext';

import type { SetValues } from './StyleInspectorContext';
import type { InheritData } from '../../helpers';
import type {
  DisplayMode,
  Element,
  StyleCategory,
  StyleItem,
  StyleObject,
  StyleState,
  StyleValue
} from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type StyleInspectorProviderProps = {
  children: ReactNode;
  selector?: StyleItem;
  styleSelector?: string;
  styleState?: StyleState;
  element?: Element;
  inheritData: InheritData;
  displayMode: DisplayMode;
  onChange?: (path?: StyleCategory, values?: StyleObject | StyleValue) => void;
};

const StyleInspectorProvider = ({
  children,
  selector,
  styleSelector = 'base',
  styleState,
  element,
  inheritData,
  displayMode,
  onChange
}: StyleInspectorProviderProps) => {
  const bindingData = useStyleBinding({ element });
  const { useDataSource } = use(DataSourceContext);
  const { variables: schemaVariables } = useDataSource<Record<string, unknown>>({ id: '', mode: 'read' });

  const setValue = useCallback(
    (styleKey?: StyleCategory, values?: StyleObject | StyleValue): void => {
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
        const newValues = { ...get(selector.attributes, `${styleSelector}.default`, {}), ...values };
        (Object.keys(newValues) as StyleCategory[]).forEach(k => {
          if (newValues[k] === undefined) {
            delete newValues[k];
          }
        });

        values = newValues;
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
        const value = keys.reduce((acum, key) => ({ ...acum, [key]: undefined }), {});
        setValue(undefined, value);
      } else {
        setValue(keys);
      }
    },
    [setValue]
  );

  const inspectorContextValue = useMemo(
    () => ({
      selector,
      styleSelector,
      styleState,
      styleVariant: undefined, // @todo: pending to implement
      displayMode,
      variables: schemaVariables,
      inheritData: inheritData.style,
      bindingData: bindingData,
      setValue,
      resetValue,
      getDefaultValue
    }),
    [
      selector,
      styleSelector,
      styleState,
      displayMode,
      schemaVariables,
      inheritData.style,
      bindingData,
      setValue,
      resetValue,
      getDefaultValue
    ]
  );

  return <StyleInspectorContext value={inspectorContextValue}>{children}</StyleInspectorContext>;
};

export default StyleInspectorProvider;
