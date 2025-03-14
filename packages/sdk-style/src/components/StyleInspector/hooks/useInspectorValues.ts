import get from 'lodash/get';
import pick from 'lodash/pick';
import { use, useMemo } from 'react';

import { VARIABLE_REGEX } from '@plitzi/sdk-schema/FlatMap';
import { emptyObject } from '@plitzi/sdk-shared/utils';

import StyleInspectorContext from '../StyleInspectorContext';
import { baseDefaultValue } from '../StyleInspectorHelper';

import type { StyleInspectorContextValue } from '../StyleInspectorContext';
import type { DisplayMode, Style, StyleValue } from '@plitzi/sdk-shared';

export type UseInspectorValuesProps = {
  keys?: string[];
  skipContext?: boolean;
  context?: StyleInspectorContextValue;
  skipValidations?: boolean;
  asValue?: boolean;
  defaultValues?: { [key: string]: number | string };
  strictMode?: boolean;
};

export type UseInspectorValuesReturn = {
  values: Style['platform'][DisplayMode][number]['attributes'];
  hasInherit: boolean;
  hasBinding: boolean;
  hasVariables: boolean;
  hasValues: boolean;
};

const useInspectorValues = ({
  keys,
  skipContext = false,
  context = {} as StyleInspectorContextValue,
  asValue = false,
  defaultValues = emptyObject,
  strictMode = false
}: UseInspectorValuesProps) => {
  if (keys && !Array.isArray(keys)) {
    throw new Error('keys is not an array');
  }

  let { inheritData, bindingData, values, variables } = {} as StyleInspectorContextValue;
  if (skipContext) {
    ({ inheritData, bindingData, values, variables } = context);
  } else {
    ({ inheritData, bindingData, values, variables } = use(StyleInspectorContext));
  }

  const hasInherit = useMemo(() => {
    return (
      !!keys && !asValue && Object.keys(inheritData).filter(key => keys.includes(key) || keys.length === 0).length > 0
    );
  }, [keys, inheritData, asValue]);

  const hasBinding = useMemo(() => {
    return (
      !!keys && !asValue && Object.keys(bindingData).filter(key => keys.includes(key) || keys.length === 0).length > 0
    );
  }, [keys, bindingData, asValue]);

  const hasVariables = useMemo(
    () =>
      !!keys &&
      !asValue &&
      Object.keys(pick(values, keys)).filter(key => typeof values[key] === 'string' && values[key].includes('var('))
        .length > 0,
    [keys, values, asValue]
  );

  const hasValues = useMemo(() => {
    if (!keys) {
      return false;
    }

    if (keys.length > 0) {
      return !asValue && Object.keys(pick(values, keys)).length > 0;
    }

    return !asValue && Object.keys(values).length > 0;
  }, [keys, values, asValue]);

  const valuesParsed = useMemo(() => {
    const valuesParsedAux: Style['platform'][DisplayMode][number]['attributes'] = {};
    if (!keys) {
      return valuesParsedAux;
    }

    keys.forEach(key => {
      let value: Style['platform'][DisplayMode][number]['attributes'][string];
      if (strictMode) {
        value = get(values, key, get(defaultValues, key));
      } else {
        value = get(
          values,
          key,
          get(
            inheritData,
            `${key}.0.value`,
            get(bindingData, `${key}.0.value`, get(defaultValues, key, baseDefaultValue[key]))
          ) as StyleValue
        );
      }

      if (typeof value === 'string' && value.includes('var(')) {
        [...value.matchAll(VARIABLE_REGEX)].forEach(match => {
          if (match.groups?.token) {
            value = (value as string).replace(match[0], get(variables, match.groups.token, match[0]) as string);
          }
        });
      }

      valuesParsedAux[key] = value;
    });

    if (keys.length === 1) {
      return valuesParsedAux[keys[0]];
    }

    return valuesParsedAux;
  }, [keys, strictMode, values, defaultValues, inheritData, bindingData, variables]);

  if (asValue) {
    return valuesParsed;
  }

  return { values: valuesParsed, hasInherit, hasBinding, hasVariables, hasValues };
};

export default useInspectorValues;
