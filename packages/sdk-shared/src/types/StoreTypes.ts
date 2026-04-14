/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

import type { Schema, Element } from './SchemaTypes';
import type { Segment } from './SegmentTypes';
import type { DisplayMode, Style, StyleState } from './StyleTypes';

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

export type SyncMode = 'mount' | 'sync';

export type StoreHookBaseOptions<TState extends object = object> = {
  store?: StoreApi<TState>;
};

export type StoreHookReactiveOptions<T, TState extends object = object> = StoreHookBaseOptions<TState> & {
  mode?: SyncMode;
  enabled?: boolean;
  equalityFn?: (a: T, b: T) => boolean;
};

export type StoreLogger<T> = (event: { path: PathOf<T> | undefined; prev: T; next: T }) => void;

export type Listener = () => void;

export type SetState<T> = {
  (path: undefined, value: T | ((prev: T) => T), canPropagate?: boolean): void;
  <P extends PathOf<T>>(
    path: P,
    value: PathValue<T, P> | ((prev: PathValue<T, P>) => PathValue<T, P>),
    canPropagate?: boolean
  ): void;
};

export type GetState<T> = () => T;

export type StoreApi<T> = {
  getState: GetState<T>;
  setState: SetState<T>;
  subscribe: (listener: Listener) => () => void;
  subscribePath: <P extends PathOf<T>>(path: P, listener: Listener) => () => void;
};

export type StoreApiInternal<T> = StoreApi<T> & {
  listeners: Set<Listener>;
  pathListeners: Map<string, Set<Listener>>;
};

export type PathOrFn<TState extends object> = PathOf<TState> | ((state: TState) => PathOf<TState>);

export type MultiPathReturn<
  TState extends object,
  Paths extends ReadonlyArray<PathOf<TState>>,
  TDefaultValue = __NoDefault
> = [PathValues<TState, Paths, TDefaultValue>, ...PathSetters<TState, Paths>];

export type UseStoreReturn<TState extends object, TArg> =
  TArg extends PathOf<TState>
    ? [PathValue<TState, TArg>, PathSetter<TState, TArg>]
    : TArg extends (state: TState) => unknown
      ? [unknown, (value: unknown) => void]
      : [TState, StoreApi<TState>['setState']];

export type UseStoreOptions<T, TState extends object = object> = StoreHookReactiveOptions<T, TState> & {
  defaultValue?: NonNullable<T>;
  transformer?: (value: T) => unknown;
};

export type UseStoreMultiOptions<
  TState extends object,
  Paths extends ReadonlyArray<PathOf<TState>>,
  TDefaultValue extends
    | readonly (PathValue<TState, Paths[number]> | undefined)[]
    | PathValue<TState, Paths[number]>
    | undefined = undefined
> = Omit<StoreHookReactiveOptions<never, TState>, 'equalityFn'> & {
  equalityFn?: (a: PathValues<TState, Paths>, b: PathValues<TState, Paths>) => boolean;
  defaultValue?: TDefaultValue;
  transformer?: (values: PathValues<TState, Paths>) => unknown;
};

export type UseStoreSyncOptions<T, TState extends object = object> = StoreHookReactiveOptions<T, TState> & {
  syncStrategy?: 'render' | 'afterRender';
};

export type UseStoreSyncMultiOptions<TState extends object = object> = Omit<
  StoreHookReactiveOptions<never, TState>,
  'equalityFn'
> & {
  syncStrategy?: 'render' | 'afterRender';
};

export type GetValueFn<TState extends object> = {
  (): TState;
  <P extends PathOf<TState>>(path: P): PathValue<TState, P>;
  <P extends PathOf<TState>, D>(path: P, defaultValue: D): NonNullable<PathValue<TState, P>> | D;
  <D>(path: undefined, defaultValue: D): NonNullable<TState> | D;
};

export type GetValueFromBaseFn<TBase> = TBase extends object
  ? {
      (): TBase;
      <SubP extends PathOf<TBase>>(path: SubP): PathValue<TBase, SubP>;
      <SubP extends PathOf<TBase>, D>(path: SubP, defaultValue: D): NonNullable<PathValue<TBase, SubP>> | D;
      <D>(path: undefined, defaultValue: D): NonNullable<TBase> | D;
    }
  : () => TBase;

export type GetValueFromBaseWithDefaultFn<TBase, D> = TBase extends object
  ? {
      (): NonNullable<TBase> | D;
      <SubP extends PathOf<NonNullable<TBase>>>(path: SubP): PathValue<NonNullable<TBase>, SubP>;
      <SubP extends PathOf<NonNullable<TBase>>, D2>(
        path: SubP,
        defaultValue: D2
      ): NonNullable<PathValue<NonNullable<TBase>, SubP>> | D2;
      <D2>(path: undefined, defaultValue: D2): NonNullable<TBase> | D2;
    }
  : () => NonNullable<TBase> | D;

type EntryGetter<TState extends object, Entry> =
  Entry extends PathOf<TState>
    ? GetValueFromBaseFn<PathValue<TState, Entry>>
    : Entry extends (state: TState) => infer R
      ? R extends object
        ? GetValueFromBaseFn<R>
        : () => R
      : never;

export type GetterTuple<
  TState extends object,
  Entries extends ReadonlyArray<PathOf<TState> | ((state: TState) => unknown)>
> = {
  [K in keyof Entries]: EntryGetter<TState, Entries[K]>;
};

export type UseStoreGetterOptions<TState extends object = object, D = __NoDefault> = StoreHookBaseOptions<TState> & {
  defaultValue?: D;
};

export type SetStateFn<TState extends object> = {
  (path: undefined, value: TState | ((prev: TState) => TState)): void;
  <P extends PathOf<TState>>(
    path: P,
    value: PathValue<TState, P> | ((prev: PathValue<TState, P>) => PathValue<TState, P>)
  ): void;
};

export type SetFromBaseFn<TBase> = TBase extends object
  ? {
      (subPath: undefined, value: TBase | ((prev: TBase) => TBase)): void;
      <SubP extends PathOf<TBase>>(
        subPath: SubP,
        value: PathValue<TBase, SubP> | ((prev: PathValue<TBase, SubP>) => PathValue<TBase, SubP>)
      ): void;
    }
  : (subPath: undefined, value: TBase) => void;

export type UseStoreSetterOptions<TState extends object = object> = StoreHookBaseOptions<TState>;

export type CommonState = {
  prevSchema?: Schema;
  schema: Schema;
  pageDefinitions: Record<string, Element>;
  style: Style;
  segments: Record<string, Segment>;
};

export type BuilderState = CommonState & {
  displayMode: DisplayMode;
  selector?: string;
  styleSelector?: string;
  styleVariant?: string;
  styleState?: StyleState;
  elementHovered?: string;
  elementSelected?: string;
  setHovered: (elementId?: string) => void;
  setSelected: (elementId?: string, iframeDOM?: HTMLIFrameElement | null, force?: boolean) => void;
};

export type SdkState = CommonState & {};
