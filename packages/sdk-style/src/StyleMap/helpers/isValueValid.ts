/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  StyleAttributes,
  StyleBlock,
  StyleCategory,
  StyleObject,
  StyleState,
  StyleStates,
  StyleValue,
  StyleVariants
} from '@plitzi/sdk-shared';

const isPrimitive = (v: any) => typeof v === 'string' || typeof v === 'number' || typeof v === 'undefined';

const isPlainObject = (v: any) => v !== null && typeof v === 'object' && !Array.isArray(v);

// ===== validators =====

export const isStyleObject = (obj: Partial<StyleObject>): boolean =>
  isPlainObject(obj) && Object.values(obj).every(isPrimitive);

export const isStyleStates = (obj: NonNullable<StyleBlock['states']>): boolean =>
  isPlainObject(obj) && Object.values(obj).every(isStyleObject);

export const isStyleVariants = (obj: NonNullable<StyleBlock['variants']>): boolean =>
  isPlainObject(obj) &&
  Object.values(obj).every(v => {
    if (!isPlainObject(v)) {
      return false;
    }

    if ('variants' in v) {
      return false;
    }

    if ('default' in v && v.default && !isStyleObject(v.default)) {
      return false;
    }

    if ('states' in v && v.states && !isStyleStates(v.states)) {
      return false;
    }

    return true;
  });

export const isStyleBlock = (obj: StyleBlock): boolean => {
  if (!isPlainObject(obj)) {
    return false;
  }

  if (!obj.default || !isStyleObject(obj.default)) {
    return false;
  }

  if (obj.states && !isStyleStates(obj.states)) {
    return false;
  }

  if (obj.variants && !isStyleVariants(obj.variants)) {
    return false;
  }

  return true;
};

export const isStyleAttributes = (obj?: StyleAttributes): boolean =>
  obj === undefined || (isPlainObject(obj) && 'base' in obj && Object.values(obj).every(isStyleBlock));

// ===== main =====

const isValidValue = (
  path?: StyleCategory,
  value?: StyleAttributes | StyleValue | Partial<StyleObject> | StyleBlock | StyleVariants | StyleStates,
  params?: { styleSelector?: string; styleVariant?: string; styleState?: StyleState }
): boolean => {
  const { styleSelector, styleVariant, styleState } = params ?? {};

  // FULL OBJECT
  if (!path && !styleSelector && !styleVariant && !styleState) {
    return isStyleAttributes(value as StyleAttributes);
  }

  if (!path && !styleSelector && styleVariant && styleState) {
    return false;
  }

  if (!path && !styleSelector && styleVariant) {
    // hey
    return isStyleVariants(value as StyleVariants);
  }

  if (!path && !styleSelector && styleState) {
    return isStyleStates(value as StyleStates);
  }

  // PATH → just primitives
  if (path) {
    return isPrimitive(value);
  }

  // DEFAULT (styleSelector)
  if (styleSelector) {
    if (value === undefined) {
      return true;
    }

    if (isPrimitive(value) || !isPlainObject(value)) {
      return false;
    }

    return isStyleObject(value as StyleObject) || isStyleBlock(value as StyleBlock);
  }

  return false;
};

export default isValidValue;
