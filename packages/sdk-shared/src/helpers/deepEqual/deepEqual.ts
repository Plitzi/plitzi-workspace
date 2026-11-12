/* eslint-disable @typescript-eslint/no-base-to-string -- two objects with a `toString` of their own (a URL, a class
   instance) are equal when they say the same; the call is made only when one of them has one */

const isEnumerable = (obj: object, key: string) => Object.getOwnPropertyDescriptor(obj, key)?.enumerable;

export type DeepEqualMetadata = { skip?: string[]; skipFunctions?: boolean };

export const deepEqual = (a: unknown, b: unknown, mode: 'soft' | 'hard' = 'soft', metadata: DeepEqualMetadata = {}) => {
  const { skip = [], skipFunctions = false } = metadata;
  if (a === b && mode === 'soft') {
    return true;
  }

  if (a && b && typeof a == 'object' && typeof b == 'object') {
    if (a.constructor !== b.constructor) {
      return false;
    }

    let length, i;
    let keys = [];
    if (Array.isArray(a)) {
      length = a.length;
      if (length != (b as unknown[]).length) {
        return false;
      }

      for (i = length; i-- !== 0;) {
        if (!deepEqual(a[i], (b as unknown[])[i], mode, metadata)) {
          return false;
        }
      }

      return true;
    }

    if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size) {
        return false;
      }

      for (i of a.values()) {
        if (!b.has(i)) {
          return false;
        }
      }

      for (i of a.entries()) {
        if (!deepEqual(i[1], b.get(i[0]), mode, metadata)) {
          return false;
        }
      }

      return true;
    }

    if (a instanceof Set && b instanceof Set) {
      if (a.size !== b.size) {
        return false;
      }

      for (i of a.entries()) {
        if (!b.has(i[0])) {
          return false;
        }
      }

      return true;
    }

    if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
      // A typed array, read by index: `ArrayBuffer.isView` narrows to a view, whose type indexes nothing.
      const left = a as unknown as ArrayLike<unknown>;
      const right = b as unknown as ArrayLike<unknown>;
      length = left.length;
      if (length != right.length) {
        return false;
      }

      for (i = length; i-- !== 0;) {
        if (left[i] !== right[i]) {
          return false;
        }
      }

      return true;
    }

    if (a.constructor === RegExp) {
      return (
        (a as RegExp).source === (b as RegExp).source &&
        (a as RegExp).global === (b as RegExp).global &&
        (a as RegExp).ignoreCase === (b as RegExp).ignoreCase &&
        (a as RegExp).multiline === (b as RegExp).multiline &&
        (a as RegExp).unicode === (b as RegExp).unicode &&
        (a as RegExp).lastIndex === (b as RegExp).lastIndex &&
        (a as RegExp).sticky === (b as RegExp).sticky
      );
    }

    if (
      (a.valueOf !== Object.prototype.valueOf || b.valueOf !== Object.prototype.valueOf) &&
      typeof a.valueOf === 'function' &&
      typeof b.valueOf === 'function'
    ) {
      return a.valueOf() === b.valueOf();
    }

    if (
      (a.toString !== Object.prototype.toString || b.toString !== Object.prototype.toString) &&
      typeof a.toString === 'function' &&
      typeof b.toString === 'function'
    ) {
      return a.toString() === b.toString();
    }

    keys = mode === 'soft' ? Object.keys(a) : Object.getOwnPropertyNames(a);
    length = keys.length;
    if (length !== (mode === 'soft' ? Object.keys(b).length : Object.getOwnPropertyNames(b).length)) {
      return false;
    }

    for (i = length; i-- !== 0;) {
      if (!Object.prototype.hasOwnProperty.call(b, keys[i])) {
        return false;
      }
    }

    for (i = length; i-- !== 0;) {
      const key = keys[i];

      if (key === '_owner' && (a as Record<string, unknown>).$$typeof) {
        // React-specific: avoid traversing React elements' _owner.
        //  _owner contains circular references
        // and is not needed when comparing the actual elements (and not their owners)
        continue;
      }

      const canGoDeeper = mode === 'soft' || isEnumerable(a, key) || !skip.includes(key);
      if (
        !deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], mode, metadata) &&
        canGoDeeper
      ) {
        return false;
      }
    }

    return true;
  }

  if ((mode === 'hard' && a === b) || (skipFunctions && typeof a === 'function' && typeof b === 'function')) {
    return true;
  }

  // true if both NaN, false otherwise
  return a !== a && b !== b;
};
