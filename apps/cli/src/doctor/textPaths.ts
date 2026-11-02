import fs from 'node:fs/promises';
import path from 'node:path';

import { CODE, CODE_FOLDERS } from './moves';

/**
 * The paths the project's code writes as text — `path.join(ROOT, 'data/store.json')`, `'functions/generated.ts'` —
 * which no import names, so a move cannot follow them: what a server reads and writes by a path it builds, a script
 * that generates a file. A move says them, and they are said again until they name where the folder is now.
 */

/** One path written as text, where it is. */
export interface TextPath {
  /** The file of code it is in, relative to the project's root. */
  file: string;
  line: number;
  /** The literal as written: `data/store.json`. */
  text: string;
  /** Whether that file also writes to the disk — the folder is then something the code keeps, not only reads. */
  writes: boolean;
}

/** What writes to the disk, as Node's `fs` names it. */
const WRITES =
  /\b(?:writeFile|writeFileSync|appendFile|appendFileSync|rename|renameSync|createWriteStream|copyFile|copyFileSync|mkdir|mkdirSync)\s*\(/;

/** A call that builds a path from parts, where a folder's name alone (`'data'`) is a path. */
const BUILDS_A_PATH = /\b(?:join|resolve)\s*\(/;

/** A line that imports — those a move rewrites — or that is a comment. */
const NOT_A_PATH = /^\s*(?:import\b|export\s+(?:\*|\{)[^;]*\bfrom\b|\/\/|\/?\*)/;

const literals = (line: string): string[] =>
  [...line.matchAll(/(['"`])((?:(?!\1)[^\\\n])*)\1/g)].map(match => match[2]);

/** Whether `text` names the folder `folder` (no trailing `/`) from the project's root. */
const names = (text: string, folder: string, building: boolean): boolean => {
  const bare = text.replace(/^\.\//, '');

  return bare.startsWith(`${folder}/`) || (building && bare === folder);
};

const filesOf = async (root: string, dir: string): Promise<string[]> => {
  const entries = await fs.readdir(path.join(root, dir), { withFileTypes: true }).catch(() => []);
  const found = await Promise.all(
    entries.map(async (entry): Promise<string[]> => {
      const each = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) {
        return entry.name === 'node_modules' ? [] : filesOf(root, each);
      }

      return CODE.test(entry.name) ? [each] : [];
    })
  );

  return found.flat();
};

/** Every path the project's code writes as text naming one of `folders` (each relative to the root, no `/` at its end). */
export const textPathsNaming = async (root: string, folders: readonly string[]): Promise<TextPath[]> => {
  if (folders.length === 0) {
    return [];
  }

  const files = (await Promise.all(CODE_FOLDERS.map(dir => filesOf(root, dir)))).flat();
  const found = await Promise.all(
    files.map(async file => {
      const text = await fs.readFile(path.join(root, file), 'utf-8');
      const writes = WRITES.test(text);

      return text.split('\n').flatMap((line, index) =>
        NOT_A_PATH.test(line)
          ? []
          : literals(line)
              .filter(each => folders.some(folder => names(each, folder, BUILDS_A_PATH.test(line))))
              .map(each => ({ file, line: index + 1, text: each, writes }))
      );
    })
  );

  return found.flat();
};

/** The paths as a line says them: `src/main.ts:5 ('data/store.json')`, the first few and how many more. */
export const pathsSaid = (paths: readonly TextPath[], shown = 4): string => {
  const said = paths.slice(0, shown).map(each => `${each.file}:${String(each.line)} ('${each.text}')`);

  return `${said.join(', ')}${paths.length > shown ? `, and ${String(paths.length - shown)} more` : ''}`;
};
