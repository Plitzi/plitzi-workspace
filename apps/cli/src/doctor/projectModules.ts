import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * A module of a package the project installed, loaded from the project's own folder: its rules are the ones of the
 * version the project runs — the length its server wants of a secret, the build its functions go through — never a copy
 * the CLI keeps of them. Undefined when the project has no such package (the packages check says so).
 */
export const projectModule = async (root: string, specifier: string): Promise<unknown> => {
  let entry: string;
  try {
    entry = createRequire(path.join(root, 'package.json')).resolve(specifier);
  } catch {
    return undefined;
  }

  return import(pathToFileURL(entry).href);
};
