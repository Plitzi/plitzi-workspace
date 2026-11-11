import { toPath } from './shared';

import type { Path } from './shared';

const holds = (value: unknown): value is object =>
  (typeof value === 'object' && value !== null) || typeof value === 'function';

/** Whether every key of the path is there, own or inherited — a value that holds no keys holds none of them. */
export function has(obj: object | null | undefined, path: Path): boolean {
  let current: unknown = obj;
  for (const key of toPath(path)) {
    if (!holds(current) || !(key in current)) {
      return false;
    }

    current = Reflect.get(current, key);
  }

  return holds(obj);
}
