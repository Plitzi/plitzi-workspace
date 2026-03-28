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

export { getTargetPath, isEmptyObject, parseValue };
