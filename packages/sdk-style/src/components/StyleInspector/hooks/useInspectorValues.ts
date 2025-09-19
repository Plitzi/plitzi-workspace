import get from 'lodash/get.js';
import pick from 'lodash/pick.js';
import { use, useMemo } from 'react';

import { baseDefaultValue } from '@plitzi/sdk-shared';
import { VARIABLE_REGEX } from '@plitzi/sdk-shared/schema/schemaConstants';

import StyleInspectorContext from '../StyleInspectorContext';

import type { StyleInspectorContextValue } from '../StyleInspectorContext';
import type { DisplayMode, Style, StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type UseInspectorValuesProps<TAsValue extends boolean> = {
  keys?: StyleCategory[];
  skipContext?: boolean;
  context?: StyleInspectorContextValue;
  skipValidations?: boolean;
  asValue?: TAsValue;
  defaultValues?: Partial<Record<StyleCategory, StyleValue>>;
  strictMode?: boolean;
  replaceTokens?: boolean;
};

export type UseInspectorValuesReturn<TAsValue extends boolean> = TAsValue extends true
  ? Record<StyleCategory, StyleValue>
  : {
      values: Record<StyleCategory, StyleValue>;
      hasInherit: boolean;
      hasBinding: boolean;
      hasVariables: boolean;
      hasValues: boolean;
    };

const useInspectorValues = <TAsValue extends boolean>({
  keys,
  skipContext = false,
  context = {} as StyleInspectorContextValue,
  asValue = false as TAsValue,
  defaultValues,
  strictMode = false,
  replaceTokens = false
}: UseInspectorValuesProps<TAsValue>): UseInspectorValuesReturn<TAsValue> => {
  let { inheritData, bindingData, values, variables } = {} as StyleInspectorContextValue;
  if (skipContext) {
    ({ inheritData, bindingData, values, variables } = context);
  } else {
    ({ inheritData, bindingData, values, variables } = use(StyleInspectorContext));
  }

  const hasInherit = useMemo(
    () =>
      !!keys &&
      !asValue &&
      (Object.keys(inheritData) as StyleCategory[]).filter(key => keys.includes(key) || keys.length === 0).length > 0,
    [keys, inheritData, asValue]
  );

  const hasBinding = useMemo(
    () =>
      !!keys &&
      !asValue &&
      (Object.keys(bindingData) as StyleCategory[]).filter(key => keys.includes(key) || keys.length === 0).length > 0,
    [keys, bindingData, asValue]
  );

  const hasVariables = useMemo(
    () =>
      !!keys &&
      !asValue &&
      (Object.keys(pick(values, keys)) as StyleCategory[]).filter(
        key => typeof values[key] === 'string' && VARIABLE_REGEX.test(values[key])
      ).length > 0,
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

    const VARIABLE_REGEX_GLOBAL = new RegExp(VARIABLE_REGEX, 'g');
    keys.forEach(key => {
      let value: StyleValue | undefined;
      if (strictMode) {
        value = get(values, key, get(defaultValues ?? ({} as Record<StyleCategory, StyleValue>), key));
      } else {
        value = get(
          values,
          key,
          get(
            inheritData,
            `${key}.0.value`,
            get(
              bindingData,
              `${key}.0.value`,
              get(defaultValues ?? ({} as Record<StyleCategory, StyleValue>), key, baseDefaultValue[key])
            )
          )
        );
      }

      if (replaceTokens && typeof value === 'string' && VARIABLE_REGEX.test(value)) {
        [...value.matchAll(VARIABLE_REGEX_GLOBAL)].forEach(match => {
          value = (value as string).replace(
            match[0],
            get(variables, match[1] ? match[1] : match[2], match[0]) as string
          );
        });
      }

      valuesParsedAux[key] = value;
    });

    return valuesParsedAux;
  }, [keys, strictMode, values, defaultValues, inheritData, bindingData, variables, replaceTokens]);

  if (asValue) {
    return valuesParsed as UseInspectorValuesReturn<TAsValue>;
  }

  return {
    values: valuesParsed,
    hasInherit,
    hasBinding,
    hasVariables,
    hasValues
  } as UseInspectorValuesReturn<TAsValue>;
};

export default useInspectorValues;
