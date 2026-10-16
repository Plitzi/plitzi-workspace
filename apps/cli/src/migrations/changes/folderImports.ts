import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import type { Migration, MigrationPlace } from '../types';

const readText = async (file: string): Promise<string | undefined> => {
  try {
    return await fs.readFile(file, 'utf-8');
  } catch {
    return undefined;
  }
};

/** Whether the installed package exports its folders (`"./*"`) — the shape that has no entry for a single file. */
const exportsFolders = async (root: string, name: string): Promise<boolean> => {
  const manifest = await readText(path.join(root, 'node_modules', name, 'package.json'));
  if (manifest === undefined) {
    return false;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(manifest);
  } catch {
    // A manifest that does not parse is the install's problem to say, not this check's: nothing is claimed of it.
    return false;
  }

  return isRecord(parsed) && isRecord(parsed.exports) && './*' in parsed.exports;
};

/**
 * A library package is imported by its root and its folders, never by a file: an import of one FILE —
 * `@plitzi/sdk-shared/helpers/isRecord` — is one the installed version no longer answers, imported from its folder
 * (`@plitzi/sdk-shared/helpers`), a default export by the name the folder gives it.
 *
 * Said, never written: which name a folder gives a file's default is the package's to say, not a guess's. Checked
 * against what is installed, so a package still on its old shape says nothing.
 */
export const folderImports: Migration = {
  id: 'folderImports',
  since: '0.38.17',
  scope: 'always',
  start: ({ root }) => {
    const folders = new Map<string, Promise<boolean>>();

    return async ({ text }) => {
      const places: MigrationPlace[] = [];
      for (const match of text.matchAll(/['"](@plitzi\/[a-z0-9-]+)\/([A-Za-z0-9_./-]+)['"]/g)) {
        const [, name, subpath] = match;
        if (!folders.has(name)) {
          folders.set(name, exportsFolders(root, name));
        }

        const isFolder = await readText(path.join(root, 'node_modules', name, 'dist', subpath, 'index.d.ts'));
        if (!(await folders.get(name)) || isFolder !== undefined) {
          continue;
        }

        const folder = path.posix.dirname(subpath);
        places.push({
          line: text.slice(0, match.index).split('\n').length,
          what: `import it from \`${folder === '.' ? name : `${name}/${folder}`}\` — a package is imported by its root and its folders, a default export by the name the folder gives it`
        });
      }

      return places;
    };
  }
};
