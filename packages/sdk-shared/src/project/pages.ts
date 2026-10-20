import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

/** A module a page can be: TypeScript or JavaScript, never a test or a declaration. */
const PAGE_MODULE = /\.(?:[cm]?[jt]sx?)$/;
const NOT_A_PAGE = /\.(?:test|spec)\.[cm]?[jt]sx?$|\.d\.[cm]?ts$/;
const FOLDER_ENTRIES = ['index.ts', 'index.tsx', 'index.js'];

/**
 * The modules a folder of pages holds, by convention (`@plitzi/sdk-authoring/node`'s `pagesIn`): each module directly in
 * it — `pets.ts` — and each folder's `index` — `home/index.ts`, whose other modules are its own. Absolute, in path order:
 * one rule for the authoring that imports them and for the CLI that follows a project's imports through them, so a page
 * is part of the space by being there, for both. None when the folder is not there.
 */
export const pageModulesIn = (folder: string): string[] => {
  if (!existsSync(folder)) {
    return [];
  }

  return readdirSync(folder, { withFileTypes: true })
    .flatMap(entry => {
      if (entry.isFile()) {
        return PAGE_MODULE.test(entry.name) && !NOT_A_PAGE.test(entry.name) ? [path.join(folder, entry.name)] : [];
      }

      const index = entry.isDirectory()
        ? FOLDER_ENTRIES.find(name => existsSync(path.join(folder, entry.name, name)))
        : undefined;

      return index ? [path.join(folder, entry.name, index)] : [];
    })
    .sort();
};
