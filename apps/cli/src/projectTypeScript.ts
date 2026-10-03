import { createRequire } from 'node:module';
import path from 'node:path';

import type TypeScript from 'typescript';

/**
 * The TypeScript a project (or a plugin package) installs, resolved from its own folder rather than the CLI's: its
 * version is the one its source is written for. Absent when it installs none.
 */
export const loadTypeScript = (root: string): typeof TypeScript | undefined => {
  try {
    // What `require` hands back is the TypeScript module — the type is the one the project's own `import` would see.
    return createRequire(path.join(root, 'package.json'))('typescript') as typeof TypeScript;
  } catch {
    return undefined;
  }
};
