/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { toPath } from './shared';

import type { Path } from './shared';

export function cloneDeep<T>(value: T, seen = new WeakMap<object, any>()): T {
  // Primitives
  if (value === null || typeof value !== 'object') {
    return value;
  }

  // Handle cycles
  if (seen.has(value)) {
    return seen.get(value);
  }

  // Handle Date
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }

  // Handle RegExp
  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags) as T;
  }

  // Handle Map
  if (value instanceof Map) {
    const m = new Map<any, any>();
    seen.set(value, m);
    value.forEach((v, k) => m.set(k, cloneDeep(v, seen)));
    return m as unknown as T;
  }

  // Handle Set
  if (value instanceof Set) {
    const s = new Set<any>();
    seen.set(value, s);
    value.forEach(v => s.add(cloneDeep(v, seen)));

    return s as unknown as T;
  }

  // Handle typed arrays (Uint8Array, Int16Array, etc.)
  if (ArrayBuffer.isView(value)) {
    // For DataView, just clone the buffer
    if (value instanceof DataView) {
      const cloned = new DataView(cloneDeep(value.buffer, seen), value.byteOffset, value.byteLength);
      seen.set(value, cloned);

      return cloned as T;
    }

    // For TypedArrays
    const ctor = (value as any).constructor;
    // .slice() returns a copy for typed arrays
    const cloned = new ctor((value as any).buffer.slice(0), (value as any).byteOffset, (value as any).length);
    seen.set(value, cloned);

    return cloned as T;
  }

  // Handle ArrayBuffer
  if (value instanceof ArrayBuffer) {
    const cloned = value.slice(0);
    seen.set(value, cloned);

    return cloned as T;
  }

  // Handle Array
  if (Array.isArray(value)) {
    const arr: Array<unknown> = [];
    seen.set(value, arr);
    (value as Array<unknown>).forEach((v, i) => (arr[i] = cloneDeep(v, seen)));

    return arr as unknown as T;
  }

  // Handle objects with prototype
  const proto = Object.getPrototypeOf(value);
  const cloned: T = Object.create(proto);
  seen.set(value, cloned);
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      (cloned as any)[key] = cloneDeep((value as any)[key], seen);
    }
  }

  return cloned;
}

export const cloneObject = <T>(obj: T) => Object.assign(Object.create(Object.getPrototypeOf(obj)), obj) as T;

/**
 * Clones only the necessary path (structural sharing).
 * Useful for immutable operations like omit without cloning the entire object.
 */
export function cloneAtPath<T extends Record<string, any>>(obj: T, path: Path): T {
  const keys = toPath(path);
  const rootClone: T = (Array.isArray(obj) ? [...obj] : cloneObject<T>(obj)) as T;
  if (!keys.length) {
    // Shallow clone root
    return rootClone;
  }

  // Clone root

  let currentOriginal: any = obj;
  let currentClone: any = rootClone;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const nextOriginal = currentOriginal?.[key];
    if (!nextOriginal || typeof nextOriginal !== 'object') {
      currentClone[key] = nextOriginal;
      break;
    }

    // Clone current branch preserving prototype
    const nextClone = Array.isArray(nextOriginal) ? [...nextOriginal] : cloneObject(nextOriginal);
    currentClone[key] = nextClone;

    // move pointers to next level
    currentOriginal = nextOriginal;
    currentClone = nextClone;
  }

  return rootClone;
}
