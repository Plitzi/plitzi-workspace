import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { projectAuthoring } from '@plitzi/sdk-authoring/node';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { SPACE_ENTRY } from '../scaffold/paths';

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

const importProject = async (file: string): Promise<unknown> => import(pathToFileURL(file).href);

/** The space a project declares in `src/space/`, with the plugin declarations it is authored with. */
export interface ProjectSpace {
  space: SpaceSpec;
  plugins: PluginDeclarationData[];
  /** The element types of the plugins it runs as they were built, which no declaration of the project's describes. */
  pluginTypes: string[];
}

/**
 * The project's own declaration, loaded as its `author` script loads it — `src/space/index.ts`, with the plugins it is
 * checked against (`projectAuthoring`): every plugin folder's `declaration.ts` and the built ones' types — for a command
 * that authors it in this process.
 */
export const loadProjectSpace = async (root: string): Promise<ProjectSpace | { problem: string }> => {
  const module = await importProject(path.join(root, SPACE_ENTRY));
  const space = isRecord(module) ? module.space : undefined;
  if (!isSpaceSpec(space)) {
    return { problem: `${SPACE_ENTRY} exports no \`space\`.` };
  }

  try {
    const { plugins, pluginTypes } = await projectAuthoring(root);

    return { space, plugins, pluginTypes };
  } catch (error) {
    return { problem: error instanceof Error ? error.message : String(error) };
  }
};
