import fs from 'node:fs/promises';
import path from 'node:path';

import type { SpaceSourceFile } from './types';
import type TypeScript from 'typescript';

/** What a relative import may name, as the project's TypeScript resolves it: the file, or its `.ts` or its index. */
const CANDIDATES = ['', '.ts', '.tsx', '.mts', '.js', '/index.ts', '/index.tsx'];

const SOURCE = /\.(?:[cm]?[jt]sx?)$/;

/** A file that is code of the space, rather than its tests or its types. */
const isSpaceCode = (file: string): boolean =>
  SOURCE.test(file) && !/\.(?:test|spec)\.[cm]?[jt]sx?$|\.d\.ts$/.test(file);

const isFile = (file: string): Promise<boolean> =>
  fs.stat(file).then(
    stat => stat.isFile(),
    () => false
  );

const resolveImport = async (from: string, specifier: string): Promise<string | undefined> => {
  const target = path.resolve(path.dirname(from), specifier);
  for (const suffix of CANDIDATES) {
    if (await isFile(target + suffix)) {
      return target + suffix;
    }
  }

  return undefined;
};

/** Every file under `dir`, recursively — none when it is not there. */
const filesUnder = async (dir: string): Promise<string[]> => {
  const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true }).catch(() => []);

  return entries.filter(entry => entry.isFile()).map(entry => path.join(entry.parentPath, entry.name));
};

/**
 * The space's source: every file of the project its entry imports, followed import by import — so a project that keeps
 * part of its space outside `src/space/` is read whole, and a file nothing imports is not taken for part of it.
 *
 * Only the project's own code: a package, a JSON file and anything under `excluded` (the plugins, which are components
 * rather than the space) are not followed.
 */
export const readSpaceSources = async (
  ts: typeof TypeScript,
  { root, entry, spaceDir, excluded }: { root: string; entry: string; spaceDir: string; excluded: readonly string[] }
): Promise<{ files: SpaceSourceFile[]; unreached: string[] }> => {
  const outside = (file: string): boolean => {
    const relative = path.relative(root, file);

    return (
      relative.startsWith('..') ||
      relative.split(path.sep).includes('node_modules') ||
      excluded.some(dir => relative === dir || relative.startsWith(`${dir}${path.sep}`))
    );
  };

  const files: SpaceSourceFile[] = [];
  const seen = new Set<string>();
  const queue = [path.join(root, entry)];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    if (seen.has(next) || outside(next) || !isSpaceCode(next)) {
      continue;
    }

    seen.add(next);
    const text = await fs.readFile(next, 'utf-8');
    const kind = next.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    files.push({
      file: path.relative(root, next),
      text,
      sourceFile: ts.createSourceFile(next, text, ts.ScriptTarget.Latest, true, kind)
    });
    for (const imported of ts.preProcessFile(text, true, true).importedFiles) {
      if (imported.fileName.startsWith('.')) {
        const resolved = await resolveImport(next, imported.fileName);
        if (resolved) {
          queue.push(resolved);
        }
      }
    }
  }

  const unreached = (await filesUnder(path.join(root, spaceDir)))
    .filter(file => isSpaceCode(file) && !seen.has(file) && !outside(file))
    .map(file => path.relative(root, file))
    .sort();

  return { files, unreached };
};
