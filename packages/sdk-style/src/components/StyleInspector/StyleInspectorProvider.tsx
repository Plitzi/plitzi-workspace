/* eslint-disable @typescript-eslint/no-dynamic-delete */
/* eslint-disable @typescript-eslint/no-array-delete */

import { get, set, omit, isEmpty } from '@plitzi/plitzi-ui/helpers';
import { produce } from 'immer';
import { useCallback, use, useMemo } from 'react';

import { baseDefaultValue } from '@plitzi/sdk-shared';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import DataSourceContext from '@plitzi/sdk-shared/dataSource/DataSourceContext';

import useStyleBinding from './hooks/useStyleBinding';
import StyleInspectorContext from './StyleInspectorContext';
import { makeSelector, type StyleHelperMetaData } from '../../StyleHelper';

import type { StyleInspectorContextValue } from './StyleInspectorContext';
import type { DisplayMode, Element, StyleCategory, StyleItem, StyleValue } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type StyleInspectorProviderProps = {
  children: ReactNode;
  selector?: StyleItem;
  styleSelector: string;
  element?: Element;
  inheritData: StyleHelperMetaData;
  displayMode: DisplayMode;
};

const StyleInspectorProvider = ({
  children,
  selector,
  styleSelector = 'base',
  element,
  inheritData,
  displayMode
}: StyleInspectorProviderProps) => {
  const { builderHandler } = use(BuilderContext);
  const bindingData = useStyleBinding({ element });
  const { useDataSource } = use(DataSourceContext);
  const { variables: schemaVariables } = useDataSource<Record<string, unknown>>({ id: '', mode: 'read' });

  const setValue: StyleInspectorContextValue['setValue'] = useCallback(
    (styleKey: StyleCategory | StyleCategory[], value?: StyleValue | Partial<Record<StyleCategory, StyleValue>>) => {
      if (Array.isArray(styleKey)) {
        styleKey.forEach((styleKeyItem, i) => {
          if (get(bindingData, styleKeyItem as string)) {
            delete styleKey[i];
            if (typeof value === 'object') {
              delete value[styleKeyItem];
            }
          }
        });
      } else if (typeof styleKey === 'string' && get(bindingData, styleKey as string)) {
        return;
      }

      if (selector && (!isEmpty(value) || typeof value === 'number')) {
        if (typeof styleKey === 'string') {
          builderHandler('styleUpdateSelector', displayMode, selector.name, selector.type, styleKey, value);
        } else if (Array.isArray(styleKey) && typeof value === 'object') {
          const newValues = { ...selector.attributes, ...value };
          (Object.keys(newValues) as StyleCategory[]).forEach(k => {
            if (newValues[k] === undefined) {
              delete newValues[k];
            }
          });

          builderHandler('styleUpdateSelector', displayMode, selector.name, selector.type, '', newValues);
        }

        return;
      }

      // // Value empty, remove it
      if (selector && selector.name) {
        if ((styleKey as string) && typeof styleKey === 'string') {
          builderHandler('styleUpdateSelector', displayMode, selector.name, selector.type, styleKey, value);
        } else if ((styleKey as string) && Array.isArray(styleKey)) {
          builderHandler(
            'styleUpdateSelector',
            displayMode,
            selector.name,
            selector.type,
            '',
            omit(selector.attributes, styleKey)
          );
        }

        return;
      }

      // New selector
      if (!element) {
        return;
      }

      const {
        definition: { type }
      } = element;

      const existingClasses = get(element, `definition.styleSelectors.${styleSelector}`);
      const customClass = makeSelector(type, styleSelector);

      if (styleKey as string) {
        if (typeof value === 'object' && Array.isArray(styleKey)) {
          value = Object.fromEntries(
            Object.entries(value).filter(entry => (entry[1] as StyleValue | undefined) !== undefined)
          );
        }

        builderHandler(
          'styleAddSelector',
          displayMode,
          customClass,
          'class',
          typeof styleKey === 'string' ? styleKey : '',
          value
        );

        builderHandler(
          'schemaUpdateElement',
          produce(element, draft => {
            if (existingClasses) {
              set(draft, `definition.styleSelectors.${styleSelector}`, `${existingClasses} ${customClass}`);
            } else {
              set(draft, `definition.styleSelectors.${styleSelector}`, customClass);
            }
          })
        );
      }
    },
    [bindingData, selector, element, styleSelector, builderHandler, displayMode]
  );

  const getDefaultValue = useCallback(
    (key?: StyleCategory[] | StyleCategory): StyleValue | Record<StyleCategory, StyleValue> => {
      if (typeof key === 'object') {
        const value: Record<string, string | number> = {};
        key.forEach(k => {
          value[k] = get(baseDefaultValue, k);
        });

        return value;
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
        setValue(keys);
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
