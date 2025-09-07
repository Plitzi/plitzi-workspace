/* eslint-disable @typescript-eslint/no-dynamic-delete */
/* eslint-disable @typescript-eslint/no-array-delete */
// Packages
import { produce } from 'immer';
import get from 'lodash/get';
import isEmpty from 'lodash/isEmpty';
import omit from 'lodash/omit';
import set from 'lodash/set';
import { useCallback, use, useMemo } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/contexts/BuilderStyleContext';
import DataSourceContext from '@plitzi/sdk-shared/dataSource/DataSourceContext';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';

import useStyleBinding from './hooks/useStyleBinding';
import StyleInspectorContext from './StyleInspectorContext';
import { baseDefaultValue } from './StyleInspectorHelper';
import { makeSelector, type StyleHelperMetaData } from '../../StyleHelper';

import type { StyleInspectorContextValue } from './StyleInspectorContext';
import type { DisplayMode, Element, StyleCategory, StyleValue } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type StyleInspectorProviderProps = {
  children: ReactNode;
  selector: string;
  styleSelector: string;
  element?: Element;
  inheritData: StyleHelperMetaData;
  displayMode?: DisplayMode;
};

const StyleInspectorProvider = ({
  children,
  selector = '',
  styleSelector = 'base',
  element,
  inheritData,
  displayMode
}: StyleInspectorProviderProps) => {
  const { builderHandler } = use(BuilderContext);
  const { style, setSelectorSelected } = use(BuilderStyleContext);
  const bindingData = useStyleBinding({ element });
  const selectorType = get(style, `platform.${displayMode}.${selector}.type`);
  const values = get(style, `platform.${displayMode}.${selector}.attributes`, {});
  const { useDataSource } = use(DataSourceContext);
  const { variables } = useDataSource<Record<string, unknown>>({ id: '', mode: 'read' });

  const setValue: StyleInspectorContextValue['setValue'] = useCallback(
    (styleKey: StyleCategory | StyleCategory[], value?: StyleValue | Record<StyleCategory, StyleValue | undefined>) => {
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

      if (selector !== '' && (!isEmpty(value) || typeof value === 'number') && selectorType) {
        if (typeof styleKey === 'string') {
          builderHandler('styleUpdateSelector', displayMode, selector, selectorType, styleKey, value);
        } else if (Array.isArray(styleKey) && typeof value === 'object') {
          const newValues = { ...values, ...value };
          Object.keys(newValues).forEach(k => {
            if (newValues[k as StyleCategory] === undefined) {
              delete newValues[k as StyleCategory];
            }
          });
          builderHandler('styleUpdateSelector', displayMode, selector, selectorType, '', newValues);
        }

        return;
      }

      // // Value empty, remove it
      if (selector !== '' && selectorType) {
        if ((styleKey as string) && typeof styleKey === 'string') {
          builderHandler('styleUpdateSelector', displayMode, selector, selectorType, styleKey, value);
        } else if ((styleKey as string) && Array.isArray(styleKey)) {
          builderHandler('styleUpdateSelector', displayMode, selector, selectorType, '', omit(values, styleKey));
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

      setSelectorSelected?.({ name: customClass, type: 'class' });
    },
    [
      bindingData,
      selector,
      selectorType,
      element,
      styleSelector,
      setSelectorSelected,
      builderHandler,
      displayMode,
      values
    ]
  );

  const getDefaultValue = useCallback((key?: string[] | string) => {
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
  }, []);

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
      values,
      variables,
      displayMode,
      selector,
      setValue,
      resetValue,
      inheritData: get(inheritData, 'style', emptyObject),
      bindingData: get(bindingData, 'style', emptyObject),
      getDefaultValue
    }),
    [displayMode, selector, setValue, resetValue, inheritData, bindingData, getDefaultValue, values, variables]
  );

  return <StyleInspectorContext value={inspectorContextValue}>{children}</StyleInspectorContext>;
};

export default StyleInspectorProvider;
