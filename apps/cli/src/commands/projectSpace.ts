import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { pluginDeclarations } from '@plitzi/sdk-authoring/node';
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

const importProject = async (file: string): Promise<unknown> => import(pathToFileURL(file).href);

/** The space a project declares in `src/space.ts`, with the plugin declarations it is authored with. */
export interface ProjectSpace {
  space: SpaceSpec;
  plugins: PluginDeclarationData[];
  /** The element types of the plugins it runs as they were built, which no declaration of the project's describes. */
  pluginTypes: string[];
}

/**
 * The element types of the plugins a project made from a space runs as they were built (`vendor/plugins/<type>/`): each
 * folder's type and every element its manifest provides — as `src/main.ts` and `plitzi/author.ts` read them. None elsewhere.
 */
const builtPluginTypes = async (root: string): Promise<string[]> => {
  const dir = path.join(root, 'vendor/plugins');
  const folders = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);

  return (
    await Promise.all(
      folders
        .filter(entry => entry.isDirectory())
        .map(async entry => {
          const text = await fs.readFile(path.join(dir, entry.name, 'plugin-manifest.json'), 'utf-8').catch(() => '');
          const manifest: unknown = text ? JSON.parse(text) : undefined;
          const provides =
            isRecord(manifest) && isRecord(manifest.pluginSchema) ? Object.keys(manifest.pluginSchema) : [];

          return [entry.name, ...provides];
        })
    )
  ).flat();
};

/**
 * The project's own declaration, loaded as its `author` script loads it — `src/space.ts`, every plugin folder's
 * `declaration.ts` and the built ones' types — for a command that authors it in this process.
 */
export const loadProjectSpace = async (root: string): Promise<ProjectSpace | { problem: string }> => {
  const module = await importProject(path.join(root, 'src/space.ts'));
  const space = isRecord(module) ? module.space : undefined;
  if (!isSpaceSpec(space)) {
    return { problem: 'src/space.ts exports no `space`.' };
  }

  let plugins: PluginDeclarationData[];
  try {
    plugins = await pluginDeclarations(path.join(root, 'src/plugins'));
  } catch (error) {
    return { problem: error instanceof Error ? error.message : String(error) };
  }

  return { space, plugins, pluginTypes: await builtPluginTypes(root) };
};
