import { camelCase, get, set } from '@plitzi/plitzi-ui/helpers/lodash';
import { QueryBuilderEvaluator } from '@plitzi/plitzi-ui/QueryBuilder';
import { produce } from 'immer';

import utility from './utility';
import { checkboxParams } from './utility/checkboxParams';
import { isTrue } from './utility/truthiness';

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

            const definition = utility[action] as (typeof utility)[string] | undefined;
            if (!definition) {
              return;
            }

            resultValue = definition.callback(resultValue, checkboxParams(definition, params) ?? {}, draft, {
              ...dataSource,
              sourceTo: toValue
            });
          });
        }

        /**
         * Once the data has answered, visibility is a yes or a no, and every answer is one — an empty text included.
         * Written only when truthy like the rest, an element shown once stayed shown when its condition came back
         * empty, and a condition that printed `0` showed it: `isVisible` hides only on `false`. Before the data answers
         * nothing is written, as before: a flag nobody has set leaves the element as it starts, which spaces rely on.
         */
        if (bkey === 'initialState' && toPath === 'visibility' && source && get(dataSource, source) !== undefined) {
          resultValue = isTrue(resultValue);
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
