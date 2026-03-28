/* eslint-disable @typescript-eslint/no-dynamic-delete */
import { isStyleObject } from './isValueValid';

import type {
  StyleBlock,
  StyleCategory,
  StyleItem,
  StyleObject,
  StyleStates,
  StyleValue,
  StyleVariants
} from '@plitzi/sdk-shared';

const applyValue = (
  path: StyleCategory | undefined,
  value:
    | StyleItem['attributes']
    | StyleValue
    | Partial<StyleObject>
    | StyleVariants
    | StyleStates
    | StyleBlock
    | undefined,
  target: StyleObject
) => {
  if (path && (typeof value === 'string' || typeof value === 'number')) {
    target[path] = value as StyleValue;

    return;
  }

  if (value && isStyleObject(value as Partial<StyleObject>)) {
    const v = value as StyleObject;
    for (const k in v) {
      if (v[k as StyleCategory] === undefined) {
        delete target[k as StyleCategory];
      } else {
        target[k as StyleCategory] = v[k as StyleCategory] as StyleValue;
      }
    }
  }
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

export { getTargetPath, isEmptyObject, applyValue };
