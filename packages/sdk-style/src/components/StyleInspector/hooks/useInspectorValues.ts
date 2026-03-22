import { get, pick } from '@plitzi/plitzi-ui/helpers';
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
  let { inheritData, bindingData, selector, styleSelector, variables } = {} as StyleInspectorContextValue;
  if (skipContext) {
    ({ inheritData, bindingData, selector, styleSelector, variables } = context);
  } else {
    ({ inheritData, bindingData, selector, styleSelector, variables } = use(StyleInspectorContext));
  }

  let attributes: Partial<Record<StyleCategory, StyleValue>>;
  if (selector?.type === 'element') {
    attributes = selector.attributes[styleSelector ? styleSelector : 'base'];
  } else {
    attributes = selector?.attributes ?? {};
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
      (Object.keys(pick(attributes, keys)) as StyleCategory[]).filter(
        key => typeof attributes[key] === 'string' && VARIABLE_REGEX.test(attributes[key])
      ).length > 0,
    [keys, attributes, asValue]
  );

  const hasValues = useMemo(() => {
    if (!keys) {
      return false;
    }

    if (keys.length > 0) {
      return !asValue && Object.keys(pick(attributes, keys)).length > 0;
    }

    return !asValue && Object.keys(attributes).length > 0;
  }, [keys, asValue, attributes]);

  const valuesParsed = useMemo(() => {
    const valuesParsedAux: Style['platform'][DisplayMode][number]['attributes'] = {};
    if (!keys) {
      return valuesParsedAux;
    }

    const VARIABLE_REGEX_GLOBAL = new RegExp(VARIABLE_REGEX, 'g');
    keys.forEach(key => {
      let value: StyleValue | undefined;
      if (strictMode) {
        value = get(attributes, key, get(defaultValues ?? ({} as Record<StyleCategory, StyleValue>), key));
      } else {
        value = get(
          attributes,
          key,
          get(
            bindingData,
            key,
            get(
              inheritData,
              `${key}.0.value`,
              get(defaultValues ?? ({} as Record<StyleCategory, StyleValue>), key, baseDefaultValue[key])
            )
          )
        ) as StyleValue | undefined;
      }

      if (replaceTokens && typeof value === 'string' && VARIABLE_REGEX.test(value)) {
        [...value.matchAll(VARIABLE_REGEX_GLOBAL)].forEach(match => {
          value = (value as string).replace(match[0], get(variables, match[1] ? match[1] : match[2], match[0]));
        });
      }

      valuesParsedAux[key] = value;
    });

    return valuesParsedAux;
  }, [keys, strictMode, replaceTokens, attributes, defaultValues, inheritData, bindingData, variables]);

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
