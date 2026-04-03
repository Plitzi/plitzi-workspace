import { get, set, camelCase } from '@plitzi/plitzi-ui';
import { QueryBuilderEvaluator } from '@plitzi/plitzi-ui/QueryBuilder';
import { produce } from 'immer';

import utility from '../utility';

import type { RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';
import type { BindingCategory, Element, ElementBinding } from '@plitzi/sdk-shared';

const getValues = (
  dataSource: Record<string, unknown>,
  source: string | undefined,
  path: string | undefined,
  result: Record<string, unknown>,
  bkey: string,
  attrKey: string
) => {
  const fromPath = path && source ? `${source}.${path}` : undefined;
  const toPath = bkey === 'initialState' ? `definition.${bkey}.${attrKey}` : `${bkey}.${attrKey}`;

  return {
    fromValue: fromPath ? get(dataSource, fromPath, get(result, toPath)) : undefined,
    toValue: get(result, toPath, fromPath ? get(dataSource, fromPath) : undefined)
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
        const { source, fromPath, transformers, when, enabled = true } = binding;
        let { toPath } = binding;
        if (!toPath || (when && !QueryBuilderEvaluator(when, dataSource, false, true)) || !enabled) {
          return;
        }

        if (bkey === 'style') {
          toPath = camelCase(toPath);
        }

        const { fromValue, toValue } = getValues(dataSource, source, fromPath, draft, bkey, toPath);
        let resultValue = fromValue;
        if (transformers && Array.isArray(transformers) && transformers.length > 0) {
          transformers.forEach(transformer => {
            const { type, action, params } = transformer;
            switch (type) {
              case 'utility': {
                const callback = get(utility, `${action}.callback`);
                if (typeof callback !== 'function') {
                  break;
                }

                resultValue = callback(resultValue, params, draft, { ...dataSource, sourceTo: toValue });

                break;
              }

              default:
            }
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
