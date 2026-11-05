/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { toPath } from './shared';

import type { Path } from './shared';

export function has(obj: Record<string, any> | null | undefined, path: Path): boolean {
  if (obj === null) {
    return false;
  }

  const parts = toPath(path);
  let current: any = obj;
  for (const key of parts) {
    if (current == null || !(key in current)) {
      return false;
    }

    current = current[key];
  }

  return true;
}
