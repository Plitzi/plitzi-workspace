import path from 'node:path';

import {
  PLUGIN_DECLARATION_FILE,
  PLUGIN_ENTRIES,
  PLUGIN_FUNCTIONS_DIR,
  PLUGINS_DIR,
  VENDOR_PLUGINS_DIR
} from '../paths';
import { finding } from './codes';
import {
  CASE_NOTE,
  JAVASCRIPT_ENTRY,
  NOT_SOURCE,
  TYPE_NAME,
  capitalized,
  entriesOf,
  exists,
  gitMove,
  holdsSource,
  nearName,
  sameIgnoringCase
} from './files';
import { readVendorPlugin } from './vendor';

import type { LayoutCode, LayoutFinding } from './codes';

/** `src/plugins/StatCard` is the plugin `statCard`: what the server registers a folder as. */
export const pluginTypeOf = (folder: string): string => `${folder.charAt(0).toLowerCase()}${folder.slice(1)}`;

/** The folder a name that cannot be a type would be: its words, each with a capital — `story-editor` is `StoryEditor`. */
const pascalCaseOf = (folder: string): string | undefined => {
  const joined = folder
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map(capitalized)
    .join('');
  // A type cannot start with a digit: `2col` is `Col2`.
  const digits = /^\d+/.exec(joined)?.[0] ?? '';
  const named = `${capitalized(joined.slice(digits.length))}${digits}`;

  return TYPE_NAME.test(named) ? named : undefined;
};

/**
 * The file an element's folder is built from, wherever the folder is — its `index.ts`, or `index.tsx` — or nothing
 * when it has neither, or both: what `plitzi plugin pack` builds a folder from, as the server does.
 */
export const elementEntry = (dir: string): string | undefined => {
  const { files } = entriesOf(dir);
  const present = PLUGIN_ENTRIES.filter(entry => files.includes(entry));

  return present.length === 1 ? path.join(dir, present[0]) : undefined;
};

/**
 * The file a folder of `src/plugins/` is built from (`elementEntry`) — or nothing when it is no plugin the server can
 * build: a name that is no element type, no entry, or both. What the server registers, and what `checkPluginFolder`
 * says why of.
 */
export const pluginEntry = (root: string, folder: string): string | undefined =>
  TYPE_NAME.test(folder) ? elementEntry(path.join(root, PLUGINS_DIR, folder)) : undefined;

interface EntryRule {
  /** The folder, relative to the root, with no `/` at its end. */
  folder: string;
  accepted: readonly string[];
  code: Extract<
    LayoutCode,
    | 'plugin-entry-missing'
    | 'plugin-functions-entry-missing'
    | 'functions-entry-missing'
    | 'runtime-entry-missing'
    | 'space-entry-missing'
  >;
  /** What goes wrong without it, after "so": `the server cannot build the plugin card`. */
  lost: string;
  /** What to write, when nothing near it is there to rename. */
  write: string;
}

/** `index.ts`, or `index.ts (or index.tsx)`. */
const acceptedText = (accepted: readonly string[]): string =>
  accepted.length > 1 ? `${accepted[0]} (or ${accepted.slice(1).join(', ')})` : accepted[0];

/** The entry of a folder the server builds or runs: there, and only one — or JavaScript, a near name, a level too deep. */
export const entryFindings = (root: string, rule: EntryRule): LayoutFinding[] => {
  const { folder, accepted, code, lost } = rule;
  const entries = entriesOf(path.join(root, folder));
  const present = accepted.filter(name => entries.files.includes(name));
  if (present.length === 1) {
    return [];
  }

  if (present.length > 1) {
    return [
      finding(
        'plugin-entry-ambiguous',
        `${folder}/`,
        `${folder}/ has both ${present.join(' and ')}, and a plugin is built from one of them.`,
        `Keep one — ${present[present.length - 1]} when it writes JSX — and delete the other.`
      )
    ];
  }

  const script = entries.files.find(name => JAVASCRIPT_ENTRY.test(name));
  if (script) {
    const to = script.endsWith('.jsx') && accepted.includes('index.tsx') ? 'index.tsx' : 'index.ts';

    return [
      finding(
        'entry-not-typescript',
        `${folder}/${script}`,
        `${folder}/${script} is JavaScript, and ${folder}/ is built from ${acceptedText(accepted)}: the project's code is TypeScript, so ${lost}.`,
        `Rename it ${to} — JavaScript is TypeScript already, types left out: ${gitMove(`${folder}/${script}`, `${folder}/${to}`)}`,
        { action: 'move', from: `${folder}/${script}`, to: `${folder}/${to}` }
      )
    ];
  }

  const near = entries.files.find(name => accepted.some(wanted => nearName(name, wanted)));
  if (near) {
    const wanted = accepted.find(each => nearName(near, each)) ?? accepted[0];

    return [
      finding(
        code,
        `${folder}/${near}`,
        `${folder}/ has no ${wanted} — did you mean ${near}? Named otherwise, ${lost}.${sameIgnoringCase(near, wanted) ? ` ${CASE_NOTE}` : ''}`,
        `Rename it ${wanted}: ${gitMove(`${folder}/${near}`, `${folder}/${wanted}`)}`,
        { action: 'move', from: `${folder}/${near}`, to: `${folder}/${wanted}` }
      )
    ];
  }

  const deeper = entries.folders.find(sub =>
    accepted.some(wanted => exists(root, `${folder}/${sub}/${wanted}`, 'file'))
  );
  if (deeper) {
    return [
      finding(
        code,
        `${folder}/${deeper}/`,
        `${folder}/ has no ${acceptedText(accepted)}, and ${folder}/${deeper}/ has: one folder too deep, so ${lost}.`,
        `Move what ${folder}/${deeper}/ holds up into ${folder}/.`,
        { action: 'move', from: `${folder}/${deeper}/`, to: `${folder}/` }
      )
    ];
  }

  return [finding(code, `${folder}/`, `${folder}/ has no ${acceptedText(accepted)}, so ${lost}.`, rule.write)];
};

/** A folder built from only when it holds code: one with a README or a `.gitkeep` alone is a placeholder. */
export const sourceEntryFindings = (root: string, rule: EntryRule): LayoutFinding[] =>
  holdsSource(entriesOf(path.join(root, rule.folder))) ? entryFindings(root, rule) : [];

/** A folder of `src/plugins/` whose name cannot be a type: what to name it instead, and what follows the rename. */
const invalidName = (folder: string): LayoutFinding => {
  const named = pascalCaseOf(folder);
  const at = `${PLUGINS_DIR}/${folder}`;

  return finding(
    'plugin-name-invalid',
    `${at}/`,
    `${at}/ cannot be a plugin: a folder of ${PLUGINS_DIR}/ is registered as the element type its name makes, and a type is a letter followed by letters and digits.${named ? ` Did you mean ${named}?` : ''}`,
    named
      ? `Rename it ${named} — the type ${pluginTypeOf(named)}: ${gitMove(at, `${PLUGINS_DIR}/${named}`)}; then type: '${pluginTypeOf(named)}' in its ${PLUGIN_DECLARATION_FILE}, and renderType: '${pluginTypeOf(named)}' where the space renders it.`
      : 'Rename it with letters and digits, starting with a letter: StatCard is the type statCard.'
  );
};

/** A plugin folder's component, to name in the entry that re-exports it: `Card.tsx` in `Card/`. */
const componentOf = (files: readonly string[], folder: string): string | undefined =>
  files.find(file => file === `${folder}.tsx`) ?? files.find(file => file === `${folder}.ts`);

const declarationFindings = (root: string, folder: string): LayoutFinding[] => {
  const at = `${PLUGINS_DIR}/${folder}`;
  const { files } = entriesOf(path.join(root, at));
  if (files.includes(PLUGIN_DECLARATION_FILE)) {
    return [];
  }

  const type = pluginTypeOf(folder);
  const lost = `authoring holds none of the space's ${type} elements to its attributes, and the builder does not offer it`;
  const near = files.find(file => nearName(file, PLUGIN_DECLARATION_FILE));
  if (near) {
    return [
      finding(
        'plugin-declaration-missing',
        `${at}/${near}`,
        `${at}/ has no ${PLUGIN_DECLARATION_FILE} — did you mean ${near}? Named otherwise, ${lost}.${sameIgnoringCase(near, PLUGIN_DECLARATION_FILE) ? ` ${CASE_NOTE}` : ''}`,
        `Rename it ${PLUGIN_DECLARATION_FILE}: ${gitMove(`${at}/${near}`, `${at}/${PLUGIN_DECLARATION_FILE}`)}`,
        { action: 'move', from: `${at}/${near}`, to: `${at}/${PLUGIN_DECLARATION_FILE}` }
      )
    ];
  }

  return [
    finding(
      'plugin-declaration-missing',
      `${at}/`,
      `${at}/ has no ${PLUGIN_DECLARATION_FILE}: ${lost}.`,
      `Write ${at}/${PLUGIN_DECLARATION_FILE} — export default { type: '${type}', … } — as npx plitzi plugin add writes one beside the component it makes.`
    )
  ];
};

/**
 * One folder of `src/plugins/` as the server reads it: a name that is a type, the entry it is built from, its server
 * half's entry, and its declaration. What the server says of a folder added while it runs, and what
 * `checkProjectLayout` says of each.
 */
export const checkPluginFolder = (root: string, folder: string): LayoutFinding[] => {
  if (!TYPE_NAME.test(folder)) {
    return [invalidName(folder)];
  }

  const at = `${PLUGINS_DIR}/${folder}`;
  const type = pluginTypeOf(folder);
  const component = componentOf(entriesOf(path.join(root, at)).files, folder);

  return [
    ...entryFindings(root, {
      folder: at,
      accepted: PLUGIN_ENTRIES,
      code: 'plugin-entry-missing',
      lost: `the server cannot build the plugin ${type}`,
      write: `Write ${at}/index.ts exporting the component by default${component ? ` — export { default } from './${component}';` : ''} — as npx plitzi plugin add writes it. Every folder of ${PLUGINS_DIR}/ is a plugin: code several plugins share goes outside it (src/shared/).`
    }),
    ...sourceEntryFindings(root, {
      folder: `${at}/${PLUGIN_FUNCTIONS_DIR}`,
      accepted: ['index.ts'],
      code: 'plugin-functions-entry-missing',
      lost: `none of the plugin's server half runs (its routes under /fn/plugins/${type}/)`,
      write: `Write ${at}/${PLUGIN_FUNCTIONS_DIR}/index.ts exporting defineFunctions({ … }) by default — as npx plitzi plugin add --server writes it.`
    }),
    ...declarationFindings(root, folder)
  ];
};

/** The element types of `src/plugins/` more than one folder makes: the server keeps one of them. */
const takenTypes = (folders: readonly string[]): LayoutFinding[] => {
  const byType = new Map<string, string[]>();
  for (const folder of folders.filter(each => TYPE_NAME.test(each))) {
    byType.set(pluginTypeOf(folder), [...(byType.get(pluginTypeOf(folder)) ?? []), folder]);
  }

  return [...byType].flatMap(([type, named]) =>
    named
      .slice(1)
      .map(folder =>
        finding(
          'plugin-type-taken',
          `${PLUGINS_DIR}/${folder}/`,
          `${PLUGINS_DIR}/${named[0]}/ and ${PLUGINS_DIR}/${folder}/ are both the plugin ${type}: the server registers a folder by its name with a small first letter, and keeps one.`,
          `Put them in one folder, or rename one: git mv ${PLUGINS_DIR}/${folder} ${PLUGINS_DIR}/<AnotherName>`
        )
      )
  );
};

/**
 * `src/plugins/` and `vendor/plugins/` as the server registers them: each plugin folder (`checkPluginFolder`), a type
 * two folders make, one both a folder and built, every built one's manifest — and a file where a folder belongs.
 */
export const pluginFindings = (root: string): LayoutFinding[] => {
  const { files, folders } = entriesOf(path.join(root, PLUGINS_DIR));
  const loose = files
    // `declarations.ts` is an older CLI's list of them, which `plitzi doctor` says of on its own.
    .filter(file => !NOT_SOURCE.has(file) && file !== 'declarations.ts')
    .map(file => {
      const { name } = path.parse(file);
      const named = (name !== 'index' && pascalCaseOf(name)) || '<Name>';

      return finding(
        'plugin-file-loose',
        `${PLUGINS_DIR}/${file}`,
        `${PLUGINS_DIR}/${file} is a file, and every plugin is a folder of ${PLUGINS_DIR}/: the server reads nothing of it.`,
        `Give it a folder with an index.ts that exports it by default — ${PLUGINS_DIR}/${named}/${file} and ${PLUGINS_DIR}/${named}/index.ts, as npx plitzi plugin add writes them — or move it out of ${PLUGINS_DIR}/.`
      );
    });
  const built = entriesOf(path.join(root, VENDOR_PLUGINS_DIR)).folders;
  const types = new Set(folders.filter(folder => TYPE_NAME.test(folder)).map(pluginTypeOf));
  const shadowed = built
    .filter(type => types.has(type))
    .map(type =>
      finding(
        'plugin-shadowed',
        `${VENDOR_PLUGINS_DIR}/${type}/`,
        `${type} is both ${VENDOR_PLUGINS_DIR}/${type}/, as it was built, and a folder of ${PLUGINS_DIR}/: the server runs the built one, and a change to the source shows nowhere.`,
        `Delete ${VENDOR_PLUGINS_DIR}/${type}/: the source is the plugin now.`
      )
    );
  const vendor = built.flatMap(type => {
    const read = readVendorPlugin(root, type);

    return 'problem' in read ? [read.problem] : [];
  });

  return [
    ...folders.flatMap(folder => checkPluginFolder(root, folder)),
    ...takenTypes(folders),
    ...loose,
    ...shadowed,
    ...vendor
  ];
};
