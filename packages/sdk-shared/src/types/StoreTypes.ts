/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

import type { Schema, Element } from './SchemaTypes';
import type { DisplayMode, Style } from './StyleTypes';
import type { Dispatch, SetStateAction } from 'react';

// ─── Internal types ───────────────────────────────────────────────────────────

export type Path = string;

export type Primitive = string | number | boolean | null | undefined | symbol | bigint;

export type PathOf<T, Seen = never> = T extends Primitive
  ? never
  : T extends Seen
    ? never
    : {
        [K in keyof T & string]-?: T[K] extends Primitive
          ? K
          : T[K] extends Array<infer U>
            ? K | `${K}.${number}` | `${K}.${number}.${PathOf<U, Seen | T>}`
            : K | `${K}.${PathOf<T[K], Seen | T>}`;
      }[keyof T & string];

export type PathValue<T, P> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? T[K] extends Array<infer U>
      ? Rest extends `${number}.${infer R}`
        ? PathValue<U, R>
        : Rest extends `${number}`
          ? U
          : never
      : PathValue<T[K], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

export type PathSetter<TState extends object, P extends PathOf<TState>> = (
  value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)
) => void;

export type __NoDefault = { __noDefault: true };
type NumericIndex<I> = I extends `${infer N extends number}` ? N : I extends number ? I : never;
export type PathValues<
  TState extends object,
  Paths extends ReadonlyArray<PathOf<TState>>,
  DefaultValue = __NoDefault
> = {
  [I in keyof Paths]: Paths[I] extends PathOf<TState>
    ? [DefaultValue] extends [__NoDefault]
      ? PathValue<TState, Paths[I]>
      : DefaultValue extends readonly any[]
        ? NumericIndex<I> extends infer NI
          ? NI extends keyof DefaultValue
            ? DefaultValue[NI] extends undefined
              ? PathValue<TState, Paths[I]> | undefined
              : NonNullable<PathValue<TState, Paths[I]>> | DefaultValue[NI]
            : PathValue<TState, Paths[I]>
          : never
        : NonNullable<PathValue<TState, Paths[I]>> | DefaultValue
    : never;
};

export type PathSetters<TState extends object, Paths extends ReadonlyArray<PathOf<TState>>> = {
  [I in keyof Paths]: Paths[I] extends PathOf<TState> ? PathSetter<TState, Paths[I]> : never;
};

// ─── Public types ─────────────────────────────────────────────────────────────

// 'mount' — writes the value to the store only on the first render.
// 'sync'  — writes the value to the store on every render where it changed (default).
export type SyncMode = 'mount' | 'sync';

export type Listener = () => void;

export type SetState<T> = {
  (path: undefined, value: T | ((prev: T) => T)): void;
  <P extends PathOf<T>>(path: P, value: PathValue<T, P> | ((prev: PathValue<T, P>) => PathValue<T, P>)): void;
};

export type GetState<T> = () => T;

export type StoreApi<T> = {
  getState: GetState<T>;
  setState: SetState<T>;
  subscribe: (listener: Listener) => () => void;
  subscribePath: <P extends PathOf<T>>(path: P, listener: Listener) => () => void;
};

// Tests purposes only
export type StoreApiInternal<T> = StoreApi<T> & {
  listeners: Set<Listener>;
  pathListeners: Map<string, Set<Listener>>;
};

// States

export type CommonState = {
  prevSchema?: Schema; // used when elements are inside a reference and refer to main schema
  schema: Schema; // current schema, normally is the main one but can be from a segment
  style: Style;
  pageDefinitions: Record<string, Element>;
};

export type BuilderState = CommonState & {
  displayMode: DisplayMode;
  selector?: string;
  setSelector: Dispatch<SetStateAction<string | undefined>>;
};

export type SdkState = CommonState & {};
