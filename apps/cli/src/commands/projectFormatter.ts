import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

/**
 * A file's text as the project's own Prettier writes it — the version it installed, its `.prettierrc` and its ignore
 * files — or as it is when the project has no Prettier installed.
 *
 * What a project made from a space was formatted with once it was installed, so what the space gives it again has to
 * be formatted the same way before it is compared with what is on disk: unformatted, every file the space gave would
 * read as changed here.
 */

export type Formatter = (file: string, text: string) => Promise<string>;

type Prettier = {
  format: (source: string, options: Record<string, unknown>) => Promise<string>;
  resolveConfig: (file: string) => Promise<Record<string, unknown> | null>;
  getFileInfo: (
    file: string,
    options: { ignorePath: string[]; resolveConfig: boolean }
  ) => Promise<{ ignored: boolean; inferredParser: string | null }>;
};

const isPrettier = (value: unknown): value is Prettier =>
  isRecord(value) && ['format', 'resolveConfig', 'getFileInfo'].every(name => typeof value[name] === 'function');

const unformatted: Formatter = (_file, text) => Promise.resolve(text);

/** Loads the project's Prettier once. A project without one formats nothing. */
export const projectFormatter = async (root: string): Promise<Formatter> => {
  let loaded: unknown;
  try {
    const resolved = createRequire(path.join(root, 'package.json')).resolve('prettier');
    loaded = await import(pathToFileURL(resolved).href);
  } catch {
    return unformatted;
  }

  // Resolved as `require` resolves it, Prettier is its CommonJS entry, whose functions arrive as the default export.
  const prettier = isPrettier(loaded) ? loaded : isRecord(loaded) ? loaded.default : undefined;
  if (!isPrettier(prettier)) {
    return unformatted;
  }

  const api = prettier;
  // What `prettier --write .` itself skips: the project's ignore files.
  const ignorePath = ['.prettierignore', '.gitignore'].map(file => path.join(root, file));

  return async (file, text) => {
    const filepath = path.join(root, file);
    const info = await api.getFileInfo(filepath, { ignorePath, resolveConfig: true });
    if (info.ignored || !info.inferredParser) {
      return text;
    }

    return api.format(text, { ...(await api.resolveConfig(filepath)), filepath });
  };
};
