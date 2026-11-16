import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The version of `@plitzi/sdk-server` this code is, read from its own `package.json` — found from where this module is,
 * as source or built, and whoever compiles it: a build-time constant is only there when this package's own build
 * defines it, and a package that bundles its source (the MCP) would read nothing. Once a process.
 */
let read: string | undefined;

export const ownVersion = (): string => {
  if (read !== undefined) {
    return read;
  }

  read = 'unknown';
  for (let dir = path.dirname(fileURLToPath(import.meta.url)); dir !== path.dirname(dir); dir = path.dirname(dir)) {
    try {
      const manifest: unknown = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
      if (
        manifest !== null &&
        typeof manifest === 'object' &&
        'name' in manifest &&
        manifest.name === '@plitzi/sdk-server' &&
        'version' in manifest &&
        typeof manifest.version === 'string'
      ) {
        read = manifest.version;

        break;
      }
    } catch {
      // No manifest here, or not one to read: the folder above may hold it.
    }
  }

  return read;
};
