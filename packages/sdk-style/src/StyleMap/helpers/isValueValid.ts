/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { StyleCategory, TagType } from '@plitzi/sdk-shared';

const isPrimitive = (v: any) => typeof v === 'string' || typeof v === 'number' || typeof v === 'undefined';

const validateDepth = (obj: any, depth: number, maxDepth: number = 1): boolean => {
  if (depth > maxDepth) {
    return false;
  }

  return Object.values(obj).every(sub => {
    if (isPrimitive(sub)) {
      return true;
    }

    if (sub === null || typeof sub !== 'object' || Array.isArray(sub)) {
      return false;
    }

    return validateDepth(sub, depth + 1, maxDepth);
  });
};

function isValidValue(type: TagType, path?: StyleCategory, value?: any, maxDepth = 1): boolean {
  if (type === 'element') {
    if (path || !value) {
      return isPrimitive(value);
    }

    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    return validateDepth(value, 1, maxDepth);
  }

  if (path || !value) {
    return isPrimitive(value);
  }

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return true;
}

export default isValidValue;
