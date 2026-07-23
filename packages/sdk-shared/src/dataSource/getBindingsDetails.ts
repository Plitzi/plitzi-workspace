import { get, set, camelCase } from '@plitzi/plitzi-ui';
import { QueryBuilderEvaluator } from '@plitzi/plitzi-ui/QueryBuilder';
import { produce } from 'immer';

import utility from './utility';

import type { BindingCategory, Element, ElementBinding } from '../types';
import type { RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';

const getValues = (
  dataSource: Record<string, unknown>,
  sourcePath: string | undefined,
  result: Record<string, unknown>,
  bkey: string,
  attrKey: string
) => {
  const toPath = bkey === 'initialState' ? `definition.${bkey}.${attrKey}` : `${bkey}.${attrKey}`;

  return {
    fromValue: sourcePath ? get(dataSource, sourcePath, get(result, toPath)) : undefined,
    toValue: get(result, toPath, sourcePath ? get(dataSource, sourcePath) : undefined)
  };
};

const getBindingsDetails = (
  dataSource: Record<string, RuleValue>,
  element: Element,
  style: Record<string, string> = {}
) => {
  const { attributes, definition } = element;
  const { bindings } = definition;
  if (!bindings || (typeof bindings === 'object' && !Object.keys(bindings).length)) {
    return { attributes, style: {}, definition };
  }

  return produce({ attributes, style, definition }, draft => {
    (Object.keys(bindings) as BindingCategory[]).forEach(bkey => {
      if (!bindings[bkey] || !Array.isArray(bindings[bkey]) || !bindings[bkey].length) {
        return;
      }

      bindings[bkey].forEach((binding: ElementBinding) => {
        const { source, transformers, when, enabled = true } = binding;
        let { to: toPath } = binding;
        if (!toPath || (when && !QueryBuilderEvaluator(when, dataSource, false, true)) || !enabled) {
          return;
        }

        if (bkey === 'style') {
          toPath = camelCase(toPath);
        }

        const { fromValue, toValue } = getValues(dataSource, source, draft, bkey, toPath);
        let resultValue = fromValue;
        if (transformers && Array.isArray(transformers) && transformers.length > 0) {
          transformers.forEach(transformer => {
            const { action, params, enabled: transformerEnabled = true } = transformer;
            if (!transformerEnabled) {
              return;
            }

            const callback = get(utility, `${action}.callback`);
            if (typeof callback !== 'function') {
              return;
            }

            resultValue = callback(resultValue, params, draft, { ...dataSource, sourceTo: toValue });
          });
        }

        if (typeof resultValue === 'boolean' || typeof resultValue === 'number' || resultValue) {
          if (bkey === 'initialState') {
            set(draft, `definition.${bkey}.${toPath}`, resultValue);
          } else {
            set(draft, `${bkey}.${toPath}`, resultValue);
          }
        }
      });
    });
  });
};

export default getBindingsDetails;
