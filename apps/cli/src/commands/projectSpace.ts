import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import type { PluginDeclarationData, SpaceSpec } from '@plitzi/sdk-authoring';

/**
 * What the module exports as `space`, taken as a declaration when it has the shape of one. `authorSpace` checks the
 * rest of it, field by field, and says what is wrong — so this only has to tell a space from anything else.
 */
const isSpaceSpec = (value: unknown): value is SpaceSpec =>
  isRecord(value) &&
  typeof value.name === 'string' &&
  typeof value.permanentUrl === 'string' &&
  Array.isArray(value.pages);

const isDeclarations = (value: unknown): value is PluginDeclarationData[] =>
  Array.isArray(value) && value.every(entry => isRecord(entry) && typeof entry.type === 'string');

const importProject = async (file: string): Promise<unknown> => import(pathToFileURL(file).href);

/** The space a project declares in `src/space.ts`, with the plugin declarations it is authored with. */
export interface ProjectSpace {
  space: SpaceSpec;
  plugins: PluginDeclarationData[];
}

/**
 * The project's own declaration, loaded as its `author` script loads it — `src/space.ts`, and the plugins in
 * `src/plugins/declarations.ts` — for a command that authors it in this process.
 */
export const loadProjectSpace = async (root: string): Promise<ProjectSpace | { problem: string }> => {
  const module = await importProject(path.join(root, 'src/space.ts'));
  const space = isRecord(module) ? module.space : undefined;
  if (!isSpaceSpec(space)) {
    return { problem: 'src/space.ts exports no `space`.' };
  }

  const registry = await importProject(path.join(root, 'src/plugins/declarations.ts')).catch(() => undefined);
  const declarations = isRecord(registry) ? registry.declarations : undefined;

  return { space, plugins: isDeclarations(declarations) ? declarations : [] };
};
