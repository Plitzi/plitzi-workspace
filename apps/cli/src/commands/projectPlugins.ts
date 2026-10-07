import path from 'node:path';

import { pluginDeclarations } from '@plitzi/sdk-authoring/node';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { PLUGINS_DIR } from '../scaffold/paths';

import type { PluginDeclarationData } from '@plitzi/sdk-authoring';

/**
 * The elements of the project's own — `src/plugins/<Name>/declaration.ts` — read as the server and authoring read them,
 * and said the way `plitzi explain` says one the SDK ships: what it takes, fires and answers, and how it is written on a
 * page. One reading for `explain <type>` and for what `plugin add` says to write.
 */

/** Every element the project declares of its own; none when it has no plugins folder or one does not load. */
export const projectPlugins = async (root: string): Promise<PluginDeclarationData[]> => {
  try {
    return await pluginDeclarations(path.join(root, PLUGINS_DIR));
  } catch {
    return [];
  }
};

// \x27 is the single quote: spelled so, it needs no quote of the other kind around it.
const SINGLE = '\x27';

const valueText = (value: unknown): string =>
  typeof value === 'string'
    ? `${SINGLE}${value.replace(/\\/g, '\\\\').replaceAll(SINGLE, `\\${SINGLE}`)}${SINGLE}`
    : JSON.stringify(value);

/** How one is put on a page: the `custom` element that hosts it, with every attribute it reads at its default. */
export const placementOf = (declaration: PluginDeclarationData, id = declaration.type): string => {
  const attributes = Object.entries(declaration.content?.attributes ?? {})
    .map(([key, value]) => `${key}: ${valueText(value)}`)
    .join(', ');

  return `custom({ id: '${id}', renderType: '${declaration.type}'${attributes ? `, ${attributes}` : ''} })`;
};

/** One of the project's elements, explained: its words, how it is written, what it takes, fires and answers. */
export const pluginText = (declaration: PluginDeclarationData): string => {
  const definition: unknown = declaration.content?.definition;
  const description = isRecord(definition) && typeof definition.description === 'string' ? definition.description : '';
  const attributes = Object.entries(declaration.content?.attributes ?? {});
  const triggers = Object.keys(declaration.triggers ?? {});
  const callbacks = Object.keys(declaration.callbacks ?? {});

  return [
    `${declaration.type} — an element of this project, in ${PLUGINS_DIR}/${description ? `: ${description}` : ''}`,
    `Written: ${placementOf(declaration)}`,
    ...(attributes.length > 0
      ? ['Attributes:', ...attributes.map(([key, value]) => `  ${key} = ${JSON.stringify(value)}`)]
      : ['Attributes: none of its own']),
    `Fires: ${triggers.length > 0 ? triggers.join(', ') : 'only what every element fires'}`,
    `Answers: ${callbacks.length > 0 ? callbacks.join(', ') : 'only what every element answers (setState, toggleState)'}`
  ].join('\n');
};
