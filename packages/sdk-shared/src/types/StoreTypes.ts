/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

export type Listener = () => void;

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
