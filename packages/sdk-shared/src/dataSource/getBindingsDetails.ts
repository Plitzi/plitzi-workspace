import { camelCase, get, set } from '@plitzi/plitzi-ui/helpers/lodash';
import { QueryBuilderEvaluator } from '@plitzi/plitzi-ui/QueryBuilder/evaluator';

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

  // `source` is the bound value and nothing else: a source with no value yet is `undefined`, not the attribute's current
  // value — that is `sourceTo`. Falling back to it made `{{ source|default('x') }}` never take its default and a
  // `{{ source ? … }}` read an element's placeholder text as an answer. Nor is `sourceTo` ever the bound value: a field
  // with none before is `undefined` there — given the source, a `styleVariant` appended to it spread the word "on" into
  // `{"0":"o","1":"n"}` beside its own key (a run's sheet).
  return {
    fromValue: sourcePath ? get(dataSource, sourcePath) : undefined,
    toValue: get(result, toPath)
  };
};

/**
 * A value a style binding may write: one CSS value, and nothing that ends it. The page server writes inline styles as
 * `name:value;` text, so a value from data carrying `;` or braces — a colour a visitor typed — would add declarations
 * of its own to the element (`red;position:fixed;inset:0`). Such a value is not written.
 */
const isStyleValue = (value: unknown): boolean =>
  typeof value === 'number' || (typeof value === 'string' && !/[;{}<>]/.test(value));

type Written = { attributes: Element['attributes']; style: Record<string, string>; definition: Element['definition'] };

/**
 * The keys `set` walks for a path — `a.b[0].c` is `a`, `b`, `0`, `c` — so each container on the way can be copied. A key
 * matches the first group and an index the second; the other is empty.
 */
const pathKeys = (path: string): string[] =>
  [...path.matchAll(/([^.[\]]+)|\[(\d+)\]/g)].map(([, key, index]) => key || index);

/**
 * Writes `value` at `path` of `written` with every object on the way copied the first time it is written through: the
 * element is the schema's, shared by every render and every element of a component, and is never changed — what is
 * not written keeps being the schema's own. `owned` holds the copies already made, which are written in place.
 *
 * Not immer's `produce`: it proxied the element and froze the result whole, for every bound element on every render — a
 * twentieth of a page's render, measured.
 */
const writeCopying = (written: Written, path: string, value: unknown, owned: WeakSet<object>): void => {
  // The same value written again changes nothing, and copies nothing: what a binding left as it was keeps being the
  // same object from one render to the next, which is what every memo below it is keyed on.
  if (Object.is(get(written, path), value)) {
    return;
  }

  let container: Record<string, unknown> = written;
  for (const key of pathKeys(path).slice(0, -1)) {
    const next = container[key];
    if (typeof next !== 'object' || next === null) {
      break;
    }

    if (!owned.has(next)) {
      const copy = Array.isArray(next) ? [...(next as unknown[])] : { ...(next as Record<string, unknown>) };
      owned.add(copy);
      container[key] = copy;
    }

    container = container[key] as Record<string, unknown>;
  }

  set(written, path, value);
};

const getBindingsDetails = (
  dataSource: Record<string, RuleValue>,
  element: Pick<Element, 'attributes' | 'definition'>,
  style: Record<string, string> = {}
) => {
  const { attributes, definition } = element;
  const { bindings } = definition;
  if (!bindings || (typeof bindings === 'object' && !Object.keys(bindings).length)) {
    return { attributes, style: {}, definition };
  }

  const draft: Written = { attributes, style, definition };
  const owned = new WeakSet<object>([draft]);
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

      // A custom property (`--who`) is written as it is named: the class reads it as `var(--who)`.
      if (bkey === 'style' && !toPath.startsWith('--')) {
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

      if (bkey === 'style' && !isStyleValue(resultValue)) {
        return;
      }

      if (typeof resultValue === 'boolean' || typeof resultValue === 'number' || resultValue) {
        writeCopying(
          draft,
          bkey === 'initialState' ? `definition.${bkey}.${toPath}` : `${bkey}.${toPath}`,
          resultValue,
          owned
        );
      }
    });
  });

  return draft;
};

export default getBindingsDetails;
