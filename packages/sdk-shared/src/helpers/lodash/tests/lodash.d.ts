/**
 * What the parity tests call of lodash itself, typed: the copies are held to answer as lodash does. Only these, and only
 * in tests — lodash is a development dependency, and `@types/lodash` is not one.
 */
declare module 'lodash' {
  type Path = string | readonly (string | number)[];

  const lodash: {
    get: (object: unknown, path: Path, defaultValue?: unknown) => unknown;
    set: <T extends object>(object: T, path: Path, value: unknown) => T;
    omit: <T extends object>(object: T, paths: readonly string[] | string) => Partial<T>;
    has: (object: unknown, path: Path) => boolean;
    capitalize: (value?: string) => string;
    camelCase: (value?: string) => string;
    cloneDeep: <T>(value: T) => T;
  };

  export default lodash;
}
