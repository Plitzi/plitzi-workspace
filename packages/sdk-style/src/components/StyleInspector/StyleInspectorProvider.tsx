/* eslint-disable @typescript-eslint/no-dynamic-delete */

import { get, omit } from '@plitzi/plitzi-ui/helpers';
import { useCallback, useMemo } from 'react';

import { baseDefaultValue } from '@plitzi/sdk-shared';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import { createStoreHook } from '@plitzi/sdk-store/createStore';

import useStyleBinding from './hooks/useStyleBinding';
import StyleInspectorContext from './StyleInspectorContext';

import type { SetValues } from './StyleInspectorContext';
import type { InheritData } from '../../helpers';
import type {
  CommonState,
  DisplayMode,
  Element,
  StyleBlock,
  StyleCategory,
  StyleItem,
  StyleObject,
  StyleState,
  StyleValue
} from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type StyleInspectorProviderProps = {
  children: ReactNode;
  componentType?: string;
  selector?: StyleItem;
  styleSelector?: string;
  styleState?: StyleState;
  styleVariant?: string;
  element?: Element;
  inheritData: InheritData;
  displayMode: DisplayMode;
  onChange?: (path?: StyleCategory, values?: StyleObject | StyleValue) => void;
};

const StyleInspectorProvider = ({
  children,
  componentType,
  selector,
  styleSelector = 'base',
  styleState,
  styleVariant,
  element,
  inheritData,
  displayMode,
  onChange
}: StyleInspectorProviderProps) => {
  const bindingData = useStyleBinding({ element });
  const { useStore } = createStoreHook<CommonState>();
  const [schemaVariables] = useStore('runtime.sources.variables', { defaultValue: emptyObject });

  const getValues = useCallback(() => {
    let attributes: Partial<Record<StyleCategory, StyleValue>> | undefined = undefined;
    if (selector && styleSelector && (selector.attributes[styleSelector] as StyleBlock | undefined)) {
      const block = selector.attributes[styleSelector];
      if (styleState && styleVariant) {
        attributes = block.variants?.[styleVariant].states?.[styleState] ?? {};
      } else if (styleVariant) {
        attributes = block.variants?.[styleVariant]?.default ?? {};
      } else if (styleState) {
        attributes = block.states?.[styleState] ?? {};
      } else {
        attributes = block.default ?? {};
      }
    } else {
      attributes = {};
    }

    return attributes;
  }, [selector, styleSelector, styleState, styleVariant]);

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
        const newValues = { ...getValues(), ...values };
        (Object.keys(newValues) as StyleCategory[]).forEach(k => {
          if (newValues[k] === undefined) {
            delete newValues[k];
          }
        });

        values = newValues;
      }

      onChange?.(styleKey, values);
    },
    [bindingData, getValues, onChange, selector]
  ) as SetValues;

  const getDefaultValue = useCallback(
    (key?: StyleCategory[] | StyleCategory): StyleValue | Record<StyleCategory, StyleValue> => {
      if (Array.isArray(key)) {
        return key.reduce<Record<string, StyleValue>>(
          (acum, key) => ({ ...acum, [key]: get(baseDefaultValue, key) }),
          {}
        );
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
      componentType,
      selector,
      styleSelector,
      styleState,
      styleVariant,
      displayMode,
      variables: schemaVariables,
      inheritData: inheritData.style,
      bindingData: bindingData,
      getValues,
      setValue,
      resetValue,
      getDefaultValue
    }),
    [
      componentType,
      selector,
      styleSelector,
      styleState,
      styleVariant,
      displayMode,
      schemaVariables,
      inheritData.style,
      bindingData,
      getValues,
      setValue,
      resetValue,
      getDefaultValue
    ]
  );

  return <StyleInspectorContext value={inspectorContextValue}>{children}</StyleInspectorContext>;
};

export default StyleInspectorProvider;
