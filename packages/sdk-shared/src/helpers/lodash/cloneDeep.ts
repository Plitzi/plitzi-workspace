import { toPath } from './shared';

import type { Path } from './shared';

const cloneValue = (value: unknown, seen: WeakMap<object, unknown>): unknown => {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  // A value met before is its clone again: a cycle stays a cycle, and a shared part stays shared.
  if (seen.has(value)) {
    return seen.get(value);
  }

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags);
  }

  if (value instanceof Map) {
    const map = new Map<unknown, unknown>();
    seen.set(value, map);
    value.forEach((item: unknown, key: unknown) => map.set(key, cloneValue(item, seen)));

    return map;
  }

  if (value instanceof Set) {
    const set = new Set<unknown>();
    seen.set(value, set);
    value.forEach((item: unknown) => set.add(cloneValue(item, seen)));

    return set;
  }

  if (value instanceof ArrayBuffer) {
    const cloned = value.slice(0);
    seen.set(value, cloned);

    return cloned;
  }

  // A DataView over a copy of its buffer — the buffer cloned once if other views share it.
  if (value instanceof DataView) {
    const buffer = cloneValue(value.buffer, seen);
    const cloned = buffer instanceof ArrayBuffer ? new DataView(buffer, value.byteOffset, value.byteLength) : value;
    seen.set(value, cloned);

    return cloned;
  }

  // A typed array copies itself (`slice`), in its own realm and of its own kind.
  if (ArrayBuffer.isView(value)) {
    const slice: unknown = Reflect.get(value, 'slice');
    const cloned: unknown = typeof slice === 'function' ? Reflect.apply(slice, value, []) : value;
    seen.set(value, cloned);

    return cloned;
  }

  if (Array.isArray(value)) {
    const list: unknown[] = [];
    seen.set(value, list);
    value.forEach((item: unknown, index) => (list[index] = cloneValue(item, seen)));

    return list;
  }

  // Any other object keeps its prototype, and its own enumerable keys are cloned onto it.
  const cloned: object = Object.create(Reflect.getPrototypeOf(value)) as object;
  seen.set(value, cloned);
  for (const key of Object.keys(value)) {
    Reflect.set(cloned, key, cloneValue(Reflect.get(value, key), seen));
  }

  return cloned;
};

// A clone has its source's type: the one place that says so.
export const cloneDeep = <T>(value: T): T => cloneValue(value, new WeakMap()) as T;

// A copy keeps its source's prototype and own keys, so it has its source's type.
export const cloneObject = <T extends object>(obj: T): T =>
  Object.assign<object, T>(Object.create(Reflect.getPrototypeOf(obj)) as object, obj);

const shallow = <T extends object>(value: T): T => (Array.isArray(value) ? ([...value] as T) : cloneObject<T>(value));

/**
 * Clones only the necessary path (structural sharing).
 * Useful for immutable operations like omit without cloning the entire object.
 */
export function cloneAtPath<T extends object>(obj: T, path: Path): T {
  const rootClone = shallow(obj);
  let currentOriginal: unknown = obj;
  let currentClone: object = rootClone;
  for (const key of toPath(path)) {
    const nextOriginal: unknown =
      typeof currentOriginal === 'object' && currentOriginal !== null ? Reflect.get(currentOriginal, key) : undefined;
    if (!nextOriginal || typeof nextOriginal !== 'object') {
      Reflect.set(currentClone, key, nextOriginal);
      break;
    }

    // Clone current branch preserving prototype, and move both pointers a level down.
    const nextClone = shallow(nextOriginal);
    Reflect.set(currentClone, key, nextClone);
    currentOriginal = nextOriginal;
    currentClone = nextClone;
  }

  return rootClone;
}
