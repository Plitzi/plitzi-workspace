/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */

import { toPath } from './shared';

import type { Path } from './shared';

type Split<S extends string, Delimiter extends string> = S extends `${infer T}${Delimiter}${infer U}`
  ? [T, ...Split<U, Delimiter>]
  : S extends ''
    ? []
    : [S];

type NormalizeArrayPath<S extends string> = S extends `[${infer B}]${infer C}`
  ? NormalizeArrayPath<`${B}${C}`>
  : S extends `${infer A}[${infer B}]${infer C}`
    ? NormalizeArrayPath<`${A}.${B}${C}`>
    : S;

type PathArray<S extends string> = Split<NormalizeArrayPath<S>, '.'>;

type DeepValue<T, Keys extends readonly string[]> = Keys extends []
  ? T
  : Keys extends [infer K, ...infer Rest]
    ? K extends string
      ? T extends readonly (infer U)[]
        ? K extends `${number}`
          ? Rest extends readonly string[]
            ? DeepValue<U, Rest>
            : U
          : unknown | undefined
        : K extends keyof T
          ? Rest extends readonly string[]
            ? DeepValue<T[K], Rest> | (undefined extends T[K] ? undefined : never)
            : T[K]
          : unknown | undefined
      : unknown | undefined
    : unknown | undefined;

type IsUnknown<T> = unknown extends T ? ([T] extends [unknown] ? true : false) : false;

type WithDefault<V, D> = IsUnknown<V> extends true ? D : NonNullable<V> | D;

export function get<T, P extends string>(obj: T, path: P): DeepValue<NonNullable<T>, PathArray<P>>;

export function get<T, P extends string, TDefault>(
  obj: T,
  path: P,
  defaultValue: TDefault
): WithDefault<DeepValue<NonNullable<T>, PathArray<P>>, TDefault>;

export function get<T, P extends Exclude<Path, string> = Exclude<Path, string>, TDefault = undefined>(
  obj: T,
  path: P,
  defaultValue?: TDefault
): Partial<T> | TDefault;

export function get(obj: unknown, path: Path, defaultValue?: unknown) {
  if (obj == null || !path) {
    return defaultValue;
  }

  const keys = toPath(path);
  if (!keys.length) {
    return defaultValue;
  }

  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') {
      return defaultValue;
    }

    // A list is read as lodash reads one: a number is an index, any other key its own property (`length`).
    current = Array.isArray(current) && /^\d+$/.test(key) ? current[Number(key)] : Reflect.get(current, key);
  }

  return current === undefined ? defaultValue : current;
}
