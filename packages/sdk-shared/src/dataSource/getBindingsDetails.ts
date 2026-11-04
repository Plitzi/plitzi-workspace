import { camelCase, set } from '@plitzi/plitzi-ui/helpers/lodash';
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
    fromValue: sourcePath ? readPath(dataSource, sourcePath) : undefined,
    toValue: readPath(result, toPath)
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

const parsedPaths = new Map<string, readonly string[]>();
/**
 * Bounded, and once full it keeps what it has: a page reads its bindings' paths in the same order on every render, and
 * a cache that evicted would drop each path just before it was read again (nexus's `getByPath` measured it).
 */
const MAX_PARSED_PATHS = 4096;

/**
 * The keys of a path — `a.b[0].c` is `a`, `b`, `0`, `c` — parsed once per path. A key matches the first group and an
 * index the second; the other is empty.
 */
const pathKeys = (path: string): readonly string[] => {
  const known = parsedPaths.get(path);
  if (known) {
    return known;
  }

  const keys = [...path.matchAll(/([^.[\]]+)|\[(\d+)\]/g)].map(([, key, index]) => key || index);
  if (parsedPaths.size < MAX_PARSED_PATHS) {
    parsedPaths.set(path, keys);
  }

  return keys;
};

/**
 * The value at `path`, read as lodash's `get` reads it — a key that is the whole path first, then key by key, through
 * anything that is not nullish (a string's `length`) — without parsing the path again on every read: lodash's own cache
 * holds 500 paths for every caller in the process and empties itself when full, and a page's bindings alone outgrow it.
 */
const readPath = (from: unknown, path: string): unknown => {
  if (typeof from === 'object' && from !== null && path in from) {
    return (from as Record<string, unknown>)[path];
  }

  let at = from;
  for (const key of pathKeys(path)) {
    if (at === null || at === undefined) {
      return undefined;
    }

    // Any value that is not nullish has properties to read, as with `get`; a primitive's are its wrapper's.
    at = (Object(at) as Record<string, unknown>)[key];
  }

  return at;
};

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
  if (Object.is(readPath(written, path), value)) {
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
      if (bkey === 'initialState' && toPath === 'visibility' && source && readPath(dataSource, source) !== undefined) {
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
