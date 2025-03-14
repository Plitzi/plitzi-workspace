/* eslint-disable @typescript-eslint/no-dynamic-delete */
/* eslint-disable @typescript-eslint/no-array-delete */
// Packages
import { produce } from 'immer';
import get from 'lodash/get';
import isEmpty from 'lodash/isEmpty';
import omit from 'lodash/omit';
import set from 'lodash/set';
import { useCallback, use, useMemo } from 'react';

import DataSourceContext from '@plitzi/sdk-data-source/DataSourceContext';
import BuilderContext from '@plitzi/sdk-shared/builder/BuilderContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/BuilderStyleContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';
import { makeSelector } from '@plitzi/sdk-style/StyleHelper';

import useStyleBinding from './hooks/useStyleBinding';
import StyleInspectorContext from './StyleInspectorContext';
import { baseDefaultValue } from './StyleInspectorHelper';

import type { StyleInspectorContextValue } from './StyleInspectorContext';
import type { StyleHelperMetaData } from '../../StyleHelper';
import type { DisplayMode, Element } from '@plitzi/sdk-shared';
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
    (styleKey: string | string[], value?: string | number | Record<string, string | number | undefined>) => {
      if (Array.isArray(styleKey)) {
        styleKey.forEach((styleKeyItem, i) => {
          if (get(bindingData, styleKeyItem)) {
            delete styleKey[i];
            if (typeof value === 'object') {
              delete value[styleKeyItem];
            }
          }
        });
      } else if (typeof styleKey === 'string' && get(bindingData, styleKey)) {
        return;
      }

      if (selector !== '' && (!isEmpty(value) || typeof value === 'number') && selectorType) {
        if (typeof styleKey === 'string') {
          builderHandler('styleUpdateSelector', displayMode, selector, selectorType, styleKey, value);
        } else if (Array.isArray(styleKey) && typeof value === 'object') {
          const newValues = { ...values, ...value };
          Object.keys(newValues).forEach(k => {
            if (newValues[k] === undefined) {
              delete newValues[k];
            }
          });
          builderHandler('styleUpdateSelector', displayMode, selector, selectorType, '', newValues);
        }

        return;
      }

      // // Value empty, remove it
      if (selector !== '' && selectorType) {
        if (styleKey && typeof styleKey === 'string') {
          builderHandler('styleUpdateSelector', displayMode, selector, selectorType, styleKey, value);
        } else if (styleKey && Array.isArray(styleKey)) {
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

      if (styleKey) {
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
    (keys: string | string[]) => {
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
