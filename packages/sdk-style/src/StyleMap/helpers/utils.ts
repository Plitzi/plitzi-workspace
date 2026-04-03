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
    | StyleItem['attributes']
    | StyleValue
    | Partial<StyleObject>
    | StyleVariants
    | StyleStates
    | StyleBlock
    | undefined,
  prevValue: StyleObject
): StyleObject => {
  if (path && (typeof value === 'string' || typeof value === 'number')) {
    return { ...prevValue, [path]: value };
  }

  if (value && isStyleObject(value as Partial<StyleObject>)) {
    const newValue = { ...(value as StyleObject) } as StyleObject;
    for (const k in value as StyleObject) {
      if (newValue[k as StyleCategory] === undefined) {
        delete newValue[k as StyleCategory];
      }
    }

    return newValue;
  }

  return prevValue;
};

const getTargetPath = (styleSelector: string, styleVariant?: string, styleState?: string) => {
  if (styleVariant && styleState) {
    return `attributes.${styleSelector}.variants.${styleVariant}.states.${styleState}`;
  }

  if (styleVariant) {
    return `attributes.${styleSelector}.variants.${styleVariant}.default`;
  }

  if (styleState) {
    return `attributes.${styleSelector}.states.${styleState}`;
  }

  return `attributes.${styleSelector}.default`;
};

const isEmptyObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0;

const writeStyle = (
  mode: 'add' | 'update' = 'add',
  styleItem: StyleItem,
  styleSelector: string,
  path?: StyleCategory,
  value?: StyleItem['attributes'] | StyleValue | Partial<StyleObject> | StyleVariants | StyleStates | StyleBlock,
  styleState?: StyleState,
  styleVariant?: string
) => {
  const targetPath = getTargetPath(styleSelector, styleVariant, styleState);
  const hasStateOrVariant = !!styleState || !!styleVariant;

  // Set Value
  if (value !== undefined) {
    if (isStyleObject(value as StyleObject) && isEmptyObject(value)) {
      // dont recreate state/variant if they dont already exists
      if (mode === 'update' && hasStateOrVariant) {
        const parentPath = styleVariant ? `attributes.${styleSelector}.variants` : `attributes.${styleSelector}.states`;
        if (!get(styleItem, parentPath)) {
          return;
        }
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
    const parentPath = styleVariant ? `attributes.${styleSelector}.variants` : `attributes.${styleSelector}.states`;

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
    const variantsPath = `attributes.${styleSelector}.variants`;
    const variants = get(styleItem, variantsPath) as StyleVariants | undefined;
    if (!variants) {
      return;
    }

    const next = omit(variants, [styleVariant]);
    if (Object.keys(next).length) {
      set(styleItem, variantsPath, next);
    } else {
      set(styleItem, `attributes.${styleSelector}`, omit(get(styleItem, `attributes.${styleSelector}`), ['variants']));
    }

    return;
  }

  // Delete State
  if (styleState) {
    const statesPath = `attributes.${styleSelector}.states`;
    const states = get(styleItem, statesPath) as StyleStates | undefined;
    if (!states) {
      return;
    }

    const next = omit(states, [styleState]);
    if (Object.keys(next).length) {
      set(styleItem, statesPath, next);
    } else {
      set(styleItem, `attributes.${styleSelector}`, omit(get(styleItem, `attributes.${styleSelector}`), ['states']));
    }

    return;
  }

  // Reset Default
  set(styleItem, targetPath, {});
};

export { getTargetPath, isEmptyObject, parseValue, writeStyle };
