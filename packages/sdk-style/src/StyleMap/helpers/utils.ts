/* eslint-disable @typescript-eslint/no-dynamic-delete */

import { get, set, omit } from '@plitzi/plitzi-ui/helpers';

import { isStyleObject } from './isValueValid';

import type {
  StyleBlock,
  StyleCategory,
  StyleItem,
  StyleObject,
  StyleState,
  StyleStates,
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

const getBlockPath = (styleSelector: string, styleAncestor?: string) =>
  styleAncestor ? `attributes.${styleSelector}.ancestors.${styleAncestor}` : `attributes.${styleSelector}`;

const getTargetPath = (styleSelector: string, styleVariant?: string, styleState?: string, styleAncestor?: string) => {
  const blockPath = getBlockPath(styleSelector, styleAncestor);
  if (styleVariant && styleState) {
    return `${blockPath}.variants.${styleVariant}.states.${styleState}`;
  }

  if (styleVariant) {
    return `${blockPath}.variants.${styleVariant}.default`;
  }

  if (styleState) {
    return `${blockPath}.states.${styleState}`;
  }

  return `${blockPath}.default`;
};

const isEmptyObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0;

// Drops `key` from the object at `path`, and each container left empty up to (not including) the selector's block
const removeKey = (styleItem: StyleItem, path: string, key: string, blockPath: string) => {
  const current = get(styleItem, path) as Record<string, unknown> | undefined;
  if (!current) {
    return;
  }

  const next = omit(current, [key]);
  if (Object.keys(next).length || path === blockPath) {
    set(styleItem, path, next);

    return;
  }

  const separator = path.lastIndexOf('.');
  removeKey(styleItem, path.slice(0, separator), path.slice(separator + 1), blockPath);
};

const writeStyle = (
  mode: 'add' | 'update' = 'add',
  styleItem: StyleItem,
  styleSelector: string,
  path?: StyleCategory,
  value?: StyleItem['attributes'] | StyleValue | Partial<StyleObject> | StyleVariants | StyleStates | StyleBlock,
  styleState?: StyleState,
  styleVariant?: string,
  styleAncestor?: string
) => {
  const blockPath = getBlockPath(styleSelector, styleAncestor);
  const targetPath = getTargetPath(styleSelector, styleVariant, styleState, styleAncestor);
  const hasStateOrVariant = !!styleState || !!styleVariant;
  const parentPath = styleVariant ? `${blockPath}.variants` : `${blockPath}.states`;

  // Set Value
  if (value !== undefined) {
    if (isStyleObject(value as StyleObject) && isEmptyObject(value)) {
      // dont recreate state/variant if they dont already exists
      if (mode === 'update' && hasStateOrVariant && !get(styleItem, parentPath)) {
        return;
      }

      set(styleItem, targetPath, {});

      return;
    }

    const current = get(styleItem, targetPath, {});
    set(styleItem, targetPath, parseValue(path, value, current));

    return;
  }

  // create empty state/variant
  if (mode === 'add' && !path && hasStateOrVariant) {
    if (!get(styleItem, parentPath)) {
      set(styleItem, targetPath, {});
    }

    return;
  }

  // Delete by path
  if (path) {
    const current = get(styleItem, targetPath, {});
    set(styleItem, targetPath, omit(current, [path]));

    return;
  }

  // Delete Variant
  if (styleVariant) {
    removeKey(styleItem, `${blockPath}.variants`, styleVariant, `attributes.${styleSelector}`);

    return;
  }

  // Delete State
  if (styleState) {
    removeKey(styleItem, `${blockPath}.states`, styleState, `attributes.${styleSelector}`);

    return;
  }

  // No path and no value under an ancestor alone purges every rule under it; clearing its rules is a `{}` value
  if (styleAncestor) {
    removeKey(styleItem, `attributes.${styleSelector}.ancestors`, styleAncestor, `attributes.${styleSelector}`);

    return;
  }

  // Reset Default
  set(styleItem, targetPath, {});
};

export { getTargetPath, isEmptyObject, parseValue, writeStyle };
