/* eslint-disable @typescript-eslint/no-dynamic-delete */

import { omit } from '@plitzi/plitzi-ui/helpers';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';
import { isStyleRules, setAtKeys, styleTargetKeys, valueAtKeys } from '@plitzi/sdk-shared/style/styleTarget';

import { isStyleObject } from './isValueValid';

import type {
  StyleBlock,
  StyleCategory,
  StyleItem,
  StyleObject,
  StyleStates,
  StyleTarget,
  StyleValue,
  StyleVariants
} from '@plitzi/sdk-shared';

const parseValue = (
  path: StyleCategory | undefined,
  value:
    StyleItem['attributes'] | StyleValue | Partial<StyleObject> | StyleVariants | StyleStates | StyleBlock | undefined,
  prevValue: StyleObject
): StyleObject => {
  if (path && (typeof value === 'string' || typeof value === 'number')) {
    return { ...prevValue, [path]: value };
  }

  if (value && isStyleObject(value as Partial<StyleObject>)) {
    const newValue = { ...(value as StyleObject) };
    for (const k in value as StyleObject) {
      if (newValue[k as StyleCategory] === undefined) {
        delete newValue[k as StyleCategory];
      }
    }

    return newValue;
  }

  return prevValue;
};

const isEmptyObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0;

// The keys of a part a target names on its way down (`['variants', 'primary']`), after its ancestor or condition
const partsOf = (keys: string[]): [string, string][] => {
  const parts: [string, string][] = [];
  for (let index = 0; index + 1 < keys.length; index += 2) {
    parts.push([keys[index], keys[index + 1]]);
  }

  return parts;
};

// Under an ancestor, a condition or a pseudo-element, a part left with only an empty `default` holds nothing: the
// builder keeps an empty variant of the class itself on purpose, as a name to pick, but those are named elsewhere
const prunesEmpty = (keys: string[]): boolean =>
  keys.includes('ancestors') || keys.includes('conditions') || keys.includes('pseudos');

// By hand rather than `omit`, which reads its keys as paths: a condition key has spaces and a colon in it
const withoutKey = (object: Record<string, unknown>, key: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(object).filter(([name]) => name !== key));

// Drops `key` from the object at `keys`, and each container left empty up to (not including) the selector's block
const removeKey = (root: Record<string, unknown>, keys: string[], key: string) => {
  const current = valueAtKeys(root, keys);
  if (!isRecord(current)) {
    return;
  }

  const next = withoutKey(current, key);
  const holdsNothing = prunesEmpty(keys) && Object.values(next).every(inner => isEmptyObject(inner));
  if ((Object.keys(next).length && !holdsNothing) || keys.length === 1) {
    setAtKeys(root, keys, next);

    return;
  }

  removeKey(root, keys.slice(0, -1), keys[keys.length - 1]);
};

const writeStyle = (
  mode: 'add' | 'update' = 'add',
  styleItem: StyleItem,
  styleSelector: string,
  path: StyleCategory | undefined,
  value:
    StyleItem['attributes'] | StyleValue | Partial<StyleObject> | StyleVariants | StyleStates | StyleBlock | undefined,
  target: StyleTarget
) => {
  // The attributes are plain objects walked by key: an ancestor (`>`) or a condition key is no dotted path segment
  const root: Record<string, unknown> = styleItem.attributes;
  const targetKeys = [styleSelector, ...styleTargetKeys(target)];
  const scoped = !!target.styleAncestor || !!target.styleCondition;
  const scopeKeys = targetKeys.slice(0, scoped ? 3 : 1);
  // The state, variant and pseudo-element on the way down, outermost first; the last pair is the rules themselves
  const parts = partsOf(targetKeys.slice(scopeKeys.length)).filter(([kind]) => kind !== 'default');
  const outermost = parts.at(0);
  const outermostContainer = outermost ? [...scopeKeys, outermost[0]] : undefined;

  // Set Value
  if (value !== undefined) {
    if (isStyleObject(value as StyleObject) && isEmptyObject(value)) {
      // Clearing the rules that hold inside an ancestor or a condition at all times leaves nothing behind
      if (scoped && !parts.length) {
        removeKey(root, scopeKeys, 'default');

        return;
      }

      // dont recreate state/variant if they dont already exists
      if (mode === 'update' && outermostContainer && valueAtKeys(root, outermostContainer) === undefined) {
        return;
      }

      setAtKeys(root, targetKeys, {});

      return;
    }

    const current = valueAtKeys(root, targetKeys);
    setAtKeys(root, targetKeys, parseValue(path, value, isStyleRules(current) ? current : {}));

    return;
  }

  // create empty state/variant
  if (mode === 'add' && !path && outermostContainer) {
    if (valueAtKeys(root, outermostContainer) === undefined) {
      setAtKeys(root, targetKeys, {});
    }

    return;
  }

  // Delete by path
  if (path) {
    const current = valueAtKeys(root, targetKeys);
    setAtKeys(root, targetKeys, omit(isStyleRules(current) ? current : {}, [path]));

    return;
  }

  // Delete the innermost part named — a state, then a pseudo-element, a variant, the ancestor or condition — and each
  // container it leaves empty
  const innermost = targetKeys.at(-1) === 'default' ? targetKeys.slice(0, -1) : targetKeys;
  if (innermost.length > 1) {
    removeKey(root, innermost.slice(0, -1), innermost[innermost.length - 1]);

    return;
  }

  // Reset Default
  setAtKeys(root, targetKeys, {});
};

export { isEmptyObject, parseValue, writeStyle };
