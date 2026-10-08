import { readFileSync } from 'node:fs';
import path from 'node:path';

import { pluginFolders } from '@plitzi/sdk-authoring/node';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { PLUGIN_DECLARATION_FILE, PLUGINS_DIR, SPACE_DIR } from '../scaffold/paths';

import type { PluginFolder } from '@plitzi/sdk-authoring/node';

/**
 * The elements of the project's own — `src/plugins/<Name>/declaration.ts` — read as the server and authoring read them,
 * and said the way `plitzi explain` says one the SDK ships: what it takes, fires and answers, and how it is written on a
 * page. One reading for `explain <type>` and for what `plugin add` says to write.
 */

/** One of them: its folder and declaration, and the attributes type the declaration exports, when it exports one. */
export interface ProjectPlugin extends PluginFolder {
  /** `SeatPickerAttributes` — what `defineElement` is typed with; absent when the declaration exports none. */
  attributes?: string;
}

/** The attributes type a declaration exports — `plugin add` writes `export type <Name>Attributes` — when it has one. */
const attributesTypeOf = (file: string): string | undefined => {
  try {
    return /^export type (\w+Attributes)\b/m.exec(readFileSync(file, 'utf-8'))?.[1];
  } catch {
    return undefined;
  }
};

/** Every element the project declares of its own; none when it has no plugins folder or one does not load. */
export const projectPlugins = async (root: string): Promise<ProjectPlugin[]> => {
  const folder = path.join(root, PLUGINS_DIR);
  try {
    return (await pluginFolders(folder)).map(plugin => ({
      ...plugin,
      attributes: attributesTypeOf(path.join(folder, plugin.name, PLUGIN_DECLARATION_FILE))
    }));
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

/**
 * How one is put on a page from `src/space/`: its declaration imported, the factory made from it — an element of the
 * plugin's own type, typed by what it declares — and a call with every attribute it reads at its default.
 */
export const placementOf = ({ name, declaration, attributes }: ProjectPlugin, id = declaration.type): string[] => {
  const { type } = declaration;
  const from = `${SINGLE}${path.posix.relative(SPACE_DIR, `${PLUGINS_DIR}/${name}/${PLUGIN_DECLARATION_FILE}`)}${SINGLE}`;
  const values = Object.entries(declaration.content?.attributes ?? {})
    .map(([key, value]) => `, ${key}: ${valueText(value)}`)
    .join('');

  return [
    `import ${type}Declaration from ${from};`,
    ...(attributes ? [`import type { ${attributes} } from ${from};`] : []),
    `const ${type} = defineElement${attributes ? `<${attributes}>` : ''}(${type}Declaration);`,
    `${type}({ id: ${valueText(id)}${values} })`
  ];
};

/** One of the project's elements, explained: its words, how it is written, what it takes, fires and answers. */
export const pluginText = (plugin: ProjectPlugin): string => {
  const { declaration } = plugin;
  const definition: unknown = declaration.content?.definition;
  const description = isRecord(definition) && typeof definition.description === 'string' ? definition.description : '';
  const attributes = Object.entries(declaration.content?.attributes ?? {});
  const triggers = Object.keys(declaration.triggers ?? {});
  const callbacks = Object.keys(declaration.callbacks ?? {});

  return [
    `${declaration.type} — an element of this project, in ${PLUGINS_DIR}/${plugin.name}/${description ? `: ${description}` : ''}`,
    'Written, in src/space/:',
    ...placementOf(plugin).map(line => `  ${line}`),
    ...(attributes.length > 0
      ? ['Attributes:', ...attributes.map(([key, value]) => `  ${key} = ${JSON.stringify(value)}`)]
      : ['Attributes: none of its own']),
    `Fires: ${triggers.length > 0 ? triggers.join(', ') : 'only what every element fires'}`,
    `Answers: ${callbacks.length > 0 ? callbacks.join(', ') : 'only what every element answers (setState, toggleState)'}`
  ].join('\n');
};
