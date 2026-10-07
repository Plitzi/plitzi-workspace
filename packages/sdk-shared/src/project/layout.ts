import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import {
  AUTHOR_FILE,
  DATA_DIR,
  FUNCTIONS_DIR,
  PLUGIN_DECLARATION_FILE,
  PLUGIN_ENTRIES,
  PLUGIN_FUNCTIONS_DIR,
  PLUGIN_MANIFEST_FILE,
  PLUGINS_DIR,
  PUBLIC_DIR,
  RUNTIME_DIR,
  SOURCE_DIR,
  SPACE_DIR,
  SPACE_ENTRY,
  VENDOR_PLUGINS_DIR
} from './paths';
import { isRecord } from '../helpers/isRecord';

/**
 * The project's layout held to what reads it: every folder the server builds, runs or serves from where the CLI puts
 * it, each with the file it starts at. One check, said the same by the three that read the project — its server at
 * boot (`serveProject`), its authoring (`projectAuthoring`: `npm run author` and the CLI's checks) and `plitzi doctor`,
 * which makes the fixes that have one reading (`autofix`). Pure file system: what a file holds is never imported.
 *
 * An `error` is what keeps a part of the project from running — a plugin the server cannot build, code in a folder
 * nothing reads, settings Node never loads — and stops the server and the authoring; a `warning` works, and should not
 * stay.
 */

export type LayoutLevel = 'error' | 'warning';

/** Every finding of the layout check, by its code: how much it matters, and what it means in a line. */
export const PROJECT_LAYOUT_CODES = {
  'plugin-entry-missing': {
    level: 'error',
    means: 'a folder of src/plugins/ with no index.ts (or index.tsx), which the server builds the plugin from'
  },
  'plugin-entry-ambiguous': {
    level: 'error',
    means: 'a folder of src/plugins/ with both index.ts and index.tsx: a plugin starts at one'
  },
  'entry-not-typescript': {
    level: 'error',
    means:
      'an entry the server builds or runs written as JavaScript (index.js, .jsx, .mjs, .cjs): the project is TypeScript'
  },
  'plugin-name-invalid': {
    level: 'error',
    means: 'a folder of src/plugins/ whose name cannot be an element type: a letter, then letters and digits'
  },
  'plugin-type-taken': {
    level: 'error',
    means: 'two folders of src/plugins/ that are the same element type (StoryEditor and storyEditor)'
  },
  'plugin-shadowed': {
    level: 'error',
    means: 'a plugin both in src/plugins/ and, as it was built, in vendor/plugins/: the built one runs'
  },
  'plugin-functions-entry-missing': {
    level: 'error',
    means: 'a plugin’s functions/ with code and no index.ts, which its server half is built from'
  },
  'functions-entry-missing': {
    level: 'error',
    means: 'src/functions/ with code and no index.ts, which the project’s functions are built from'
  },
  'runtime-entry-missing': {
    level: 'error',
    means: 'src/runtime/ with code and no index.ts, which the space’s runtime starts at'
  },
  'space-entry-missing': {
    level: 'error',
    means: 'a space written in the project with no src/space/index.ts, which the server and npm run author import'
  },
  'space-default-export': {
    level: 'error',
    means: 'src/space/index.ts exporting the space by default, where it is imported by name: `space`'
  },
  'vendor-manifest-missing': {
    level: 'error',
    means: 'a built plugin (vendor/plugins/<type>/) with no plugin-manifest.json'
  },
  'vendor-manifest-invalid': {
    level: 'error',
    means: 'a built plugin’s plugin-manifest.json that is not a manifest'
  },
  'vendor-script-missing': {
    level: 'error',
    means: 'a built plugin’s manifest naming no script to run, or one that is not there'
  },
  'env-in-src': {
    level: 'error',
    means: '.env inside src/: Node reads the project’s settings from the .env at its root'
  },
  'folder-misplaced': {
    level: 'error',
    means: 'code in a folder named like one the server reads (src/plugin/, plugins/ at the root): nothing reads it'
  },
  'folder-near-miss': {
    level: 'warning',
    means: 'a folder named like one the server reads (src/Data/, src/runtimes/), which nothing reads'
  },
  'plugin-declaration-missing': {
    level: 'warning',
    means: 'a plugin folder with no declaration.ts: the space’s use of the plugin is held to nothing'
  },
  'plugin-file-loose': {
    level: 'warning',
    means: 'a file directly in src/plugins/, where every plugin is a folder'
  },
  'data-not-json': {
    level: 'warning',
    means: 'a file of src/data/ that is not JSON, which no provider and no ctx.data reads'
  },
  'env-missing': {
    level: 'warning',
    means: 'no .env at the project’s root: none of its settings is set'
  },
  'env-example-missing': {
    level: 'warning',
    means: 'no .env.example: a clone does not know what .env must hold'
  },
  'public-data': {
    level: 'warning',
    means: 'JSON in public/data/ of a project with a server: served to anyone who asks'
  },
  'public-secret-file': {
    level: 'warning',
    means: 'a file in public/ named like a secret (.env, a key, a dump): served to anyone who asks'
  }
} as const satisfies Record<string, { level: LayoutLevel; means: string }>;

export type LayoutCode = keyof typeof PROJECT_LAYOUT_CODES;

/**
 * The fix of a finding that has one reading, for `plitzi doctor --fix` to make. Paths are relative to the root, a
 * folder's ending in `/`: a `move` of a folder takes everything under it, into a folder that may already be there.
 */
export type LayoutAutofix =
  | { action: 'move'; from: string; to: string }
  | { action: 'copy'; from: string; to: string }
  | { action: 'write'; file: string; contents: string };

/** One thing out of place: where (`file`, relative to the root), what is wrong, and what to do — the command, if any. */
export interface LayoutFinding {
  level: LayoutLevel;
  code: LayoutCode;
  file: string;
  message: string;
  fix: string;
  autofix?: LayoutAutofix;
}

export interface ProjectLayoutOptions {
  /** Whether the project runs a server of its own — told by its `@plitzi/sdk-server` dependency when left out. */
  mode?: 'server' | 'client';
  /** Where its space is: written in it (`src/space/`), or kept on Plitzi — told by its files when left out. */
  space?: 'local' | 'cloud';
}

const finding = (
  code: LayoutCode,
  file: string,
  message: string,
  fix: string,
  autofix?: LayoutAutofix
): LayoutFinding => ({
  level: PROJECT_LAYOUT_CODES[code].level,
  code,
  file,
  message,
  fix,
  ...(autofix ? { autofix } : {})
});

/** What a folder holds besides its code — never a reason for it to need an entry. */
const NOT_SOURCE: ReadonlySet<string> = new Set(['.gitkeep', 'README.md', '.DS_Store']);

const JAVASCRIPT_ENTRY = /^index\.(?:js|jsx|mjs|cjs)$/;

/** An element type: what a folder of `src/plugins/` is registered as, and a space renders it by. */
const TYPE_NAME = /^[A-Za-z][A-Za-z0-9]*$/;

interface Entries {
  files: string[];
  folders: string[];
}

/**
 * A folder's files and folders, by the names they have — never by a lookup, which a macOS or Windows disk answers
 * ignoring case: `Index.ts` is found as `index.ts` there, and not on the Linux the project is deployed to.
 */
const entriesOf = (dir: string): Entries => {
  const found: Entries = { files: [], folders: [] };
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      // A link is what it points at: a `.env` linked from elsewhere is the project's `.env`.
      const linked = entry.isSymbolicLink()
        ? statSync(path.join(dir, entry.name), { throwIfNoEntry: false })
        : undefined;
      if (entry.isFile() || linked?.isFile()) {
        found.files.push(entry.name);
      } else if (entry.isDirectory() || linked?.isDirectory()) {
        found.folders.push(entry.name);
      }
    }
  } catch {
    return found;
  }

  return { files: found.files.sort(), folders: found.folders.sort() };
};

/** Whether `relative` is there under `root`, every part of it named exactly so. */
const exists = (root: string, relative: string, kind: 'file' | 'folder'): boolean => {
  const parts = relative.split('/').filter(part => part !== '' && part !== '.');
  let dir = root;
  for (const [index, part] of parts.entries()) {
    const { files, folders } = entriesOf(dir);
    const last = index === parts.length - 1;
    if (!(last && kind === 'file' ? files : folders).includes(part)) {
      return false;
    }

    dir = path.join(dir, part);
  }

  return true;
};

/** Every file under a folder, relative to the root — none of a folder named in `skipping`. */
const filesUnder = (root: string, folder: string, skipping: ReadonlySet<string> = new Set()): string[] => {
  const { files, folders } = entriesOf(path.join(root, folder));

  return [
    ...files.map(file => `${folder}/${file}`),
    ...folders.filter(each => !skipping.has(each)).flatMap(each => filesUnder(root, `${folder}/${each}`, skipping))
  ];
};

const holdsSource = ({ files, folders }: Entries): boolean =>
  folders.length > 0 || files.some(file => !NOT_SOURCE.has(file));

const sameIgnoringCase = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

const capitalized = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/** How many single-letter edits — a letter added, taken, changed, or two swapped — turn `a` into `b`. */
const editDistance = (a: string, b: string): number => {
  const rows = Array.from({ length: a.length + 1 }, (_row, i) =>
    Array.from({ length: b.length + 1 }, (_cell, j) => Math.max(i, j) * Number(i === 0 || j === 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }

  return rows[a.length][b.length];
};

/**
 * Whether `name` is `wanted` mistyped: the same but for case, one `s` more or less, or — for a name long enough that one
 * letter does not make another word — one edit away. `wanted` itself is not.
 */
const nearName = (name: string, wanted: string): boolean => {
  if (name === wanted) {
    return false;
  }

  const a = name.toLowerCase();
  const b = wanted.toLowerCase();

  return a === b || a === `${b}s` || `${a}s` === b || (b.length >= 5 && editDistance(a, b) <= 1);
};

/** On a disk that ignores case — macOS's, Windows' — two names that differ only in case are one file. */
const CASE_NOTE =
  'macOS and Windows disks ignore case, so it is found there — and not on Linux, where the project is deployed.';

/** A rename git makes on a disk that ignores case too: through a name of its own, when only case changes. */
const gitMove = (from: string, to: string): string =>
  sameIgnoringCase(from, to) ? `git mv ${from} ${from}-tmp && git mv ${from}-tmp ${to}` : `git mv ${from} ${to}`;

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
const entryFindings = (root: string, rule: EntryRule): LayoutFinding[] => {
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
const sourceEntryFindings = (root: string, rule: EntryRule): LayoutFinding[] =>
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

/** What a built plugin runs, by absolute path: its script, its style and its server half, as its manifest names them. */
export interface VendorPlugin {
  script: string;
  style?: string;
  version: string;
  functions?: string;
}

type ManifestAsset = { src: string; type: string; isMain: boolean };

const assetsOf = (manifest: Record<string, unknown>): ManifestAsset[] =>
  isRecord(manifest.assets)
    ? Object.values(manifest.assets).flatMap(asset =>
        isRecord(asset) && typeof asset.src === 'string' && typeof asset.type === 'string'
          ? [{ src: asset.src, type: asset.type, isMain: asset.isMain === true }]
          : []
      )
    : [];

/**
 * A plugin of `vendor/plugins/` — one a project made from a space runs as it was built, beside the manifest `plitzi
 * pack plugin` wrote when it was published — or what keeps it from running.
 */
export const readVendorPlugin = (root: string, type: string): VendorPlugin | { problem: LayoutFinding } => {
  const at = `${VENDOR_PLUGINS_DIR}/${type}`;
  const file = `${at}/${PLUGIN_MANIFEST_FILE}`;
  const again = `npx plitzi space pull brings it again — or delete ${at}/, and the space renders no ${type}.`;
  if (!exists(root, file, 'file')) {
    return {
      problem: finding(
        'vendor-manifest-missing',
        `${at}/`,
        `${at}/ has no ${PLUGIN_MANIFEST_FILE}: the server runs a built plugin by what its manifest names, so ${type} does not run.`,
        again
      )
    };
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(readFileSync(path.join(root, file), 'utf-8'));
  } catch (error) {
    return {
      problem: finding(
        'vendor-manifest-invalid',
        file,
        `${file} is not JSON (${error instanceof Error ? error.message : String(error)}), so ${type} does not run.`,
        again
      )
    };
  }

  if (!isRecord(manifest)) {
    return {
      problem: finding('vendor-manifest-invalid', file, `${file} is not a manifest, so ${type} does not run.`, again)
    };
  }

  const assets = assetsOf(manifest);
  const script =
    assets.find(asset => asset.type === 'script' && asset.isMain) ?? assets.find(asset => asset.type === 'script');
  if (!script) {
    return {
      problem: finding('vendor-script-missing', file, `${file} names no script to run, so ${type} does not run.`, again)
    };
  }

  if (!exists(root, path.posix.join(at, script.src), 'file')) {
    return {
      problem: finding(
        'vendor-script-missing',
        file,
        `${file} names ${script.src} as the script to run, and ${at}/${script.src} is not there, so ${type} does not run.`,
        again
      )
    };
  }

  const style = assets.find(asset => asset.type === 'style');

  return {
    script: path.join(root, at, script.src),
    ...(style ? { style: path.join(root, at, style.src) } : {}),
    version: typeof manifest.version === 'string' ? manifest.version : '1.0.0',
    ...(typeof manifest.functions === 'string' ? { functions: path.join(root, at, manifest.functions) } : {})
  };
};

/**
 * `src/plugins/` and `vendor/plugins/` as the server registers them: each plugin folder (`checkPluginFolder`), a type
 * two folders make, one both a folder and built, every built one's manifest — and a file where a folder belongs.
 */
const pluginFindings = (root: string): LayoutFinding[] => {
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

/** A folder the server reads, and what in a folder named like it says it was meant for it. */
interface ReadFolder {
  /** Where it is, relative to the root. */
  at: string;
  /** What reads it, said after "did you mean …?". */
  reads: string;
  /** What, in a folder named like it, is unmistakably meant for it — nothing, when only the name tells. */
  holds?: (folder: string) => string | undefined;
}

/** The first of `wanted` among `files`, case aside: an entry is named before a declaration. */
const hasIgnoringCase = (files: readonly string[], wanted: readonly string[]): string | undefined =>
  wanted.map(each => files.find(file => sameIgnoringCase(file, each))).find(file => file !== undefined);

/** A plugin in a folder: a subfolder with an entry or a declaration. */
const holdsPlugin =
  (root: string) =>
  (folder: string): string | undefined => {
    for (const sub of entriesOf(path.join(root, folder)).folders) {
      const file = hasIgnoringCase(entriesOf(path.join(root, folder, sub)).files, [
        ...PLUGIN_ENTRIES,
        PLUGIN_DECLARATION_FILE
      ]);
      if (file) {
        return `${folder}/${sub}/${file}`;
      }
    }

    return undefined;
  };

const holdsEntry =
  (root: string) =>
  (folder: string): string | undefined => {
    const file = hasIgnoringCase(entriesOf(path.join(root, folder)).files, ['index.ts']);

    return file ? `${folder}/${file}` : undefined;
  };

/** The folders the server reads that a project may misname, for this project. */
const readFolders = (root: string, { mode, space }: Required<ProjectLayoutOptions>): ReadFolder[] => [
  { at: PLUGINS_DIR, reads: `the server builds plugins from ${PLUGINS_DIR}/ only`, holds: holdsPlugin(root) },
  {
    at: FUNCTIONS_DIR,
    reads: `the project's functions are built from ${FUNCTIONS_DIR}/ only`,
    holds: holdsEntry(root)
  },
  { at: RUNTIME_DIR, reads: `the space's runtime is run from ${RUNTIME_DIR}/ only`, holds: holdsEntry(root) },
  ...(space === 'local'
    ? [
        {
          at: SPACE_DIR,
          reads: `the server's entry point and ${AUTHOR_FILE} import the space from ${SPACE_ENTRY}`,
          holds: holdsEntry(root)
        }
      ]
    : []),
  ...(mode === 'server'
    ? [{ at: DATA_DIR, reads: `the server reads the project's data from ${DATA_DIR}/ only (/data/<file>, ctx.data)` }]
    : []),
  { at: PUBLIC_DIR, reads: `the server serves ${PUBLIC_DIR}/ only, at the site's root` }
];

/** Where a folder named like `at` may be by mistake: beside it, or a level up or down — `plugins/`, `src/public/`. */
const nearMissesOf = (root: string, at: string): string[] => {
  const parent = path.posix.dirname(at);
  const name = path.posix.basename(at);
  const other = parent === '.' ? SOURCE_DIR : '.';
  const besides = entriesOf(path.join(root, parent))
    .folders.filter(folder => nearName(folder, name))
    .map(folder => path.posix.join(parent, folder));
  const elsewhere = entriesOf(path.join(root, other))
    .folders.filter(folder => folder === name || nearName(folder, name))
    .map(folder => path.posix.join(other, folder));

  return [...besides, ...elsewhere];
};

const nearMissFindings = (root: string, options: Required<ProjectLayoutOptions>): LayoutFinding[] =>
  readFolders(root, options).flatMap(({ at, reads, holds }) =>
    nearMissesOf(root, at).map(found => {
      const held = holds?.(found);
      const caseOnly = sameIgnoringCase(found, at);
      const said = `did you mean ${at}/? ${capitalized(reads)}.${caseOnly ? ` ${CASE_NOTE}` : ''}`;
      let fix = `Move it: ${gitMove(found, at)}`;
      if (caseOnly) {
        fix = `Rename it: ${gitMove(found, at)}`;
      } else if (exists(root, at, 'folder')) {
        fix = `Move what it holds into ${at}/, and delete it.`;
      }

      const autofix: LayoutAutofix = { action: 'move', from: `${found}/`, to: `${at}/` };

      return held
        ? finding(
            'folder-misplaced',
            `${found}/`,
            `${found}/ holds ${held}, and nothing reads it there — ${said}`,
            fix,
            autofix
          )
        : finding('folder-near-miss', `${found}/`, `${found}/ is read by nothing — ${said}`, fix, autofix);
    })
  );

/** The space's entry, in a project whose space is its own: there, and exporting the space by the name it is imported by. */
const spaceFindings = (root: string, misplaced: readonly LayoutFinding[]): LayoutFinding[] => {
  if (!exists(root, SPACE_ENTRY, 'file')) {
    // A space folder misnamed (`src/Space/`) is said once, as that.
    const misnamed = misplaced.some(
      each => each.code === 'folder-misplaced' && each.autofix?.action === 'move' && each.autofix.to === `${SPACE_DIR}/`
    );

    return misnamed
      ? []
      : entryFindings(root, {
          folder: SPACE_DIR,
          accepted: ['index.ts'],
          code: 'space-entry-missing',
          lost: `the server's entry point and ${AUTHOR_FILE}, which import the space from ${SPACE_ENTRY}, do not start`,
          write: `Write ${SPACE_ENTRY} exporting the space — export const space = { name, permanentUrl, pages } — or bring back the one git has: git checkout -- ${SPACE_ENTRY}`
        });
  }

  const text = readFileSync(path.join(root, SPACE_ENTRY), 'utf-8');
  const byDefault = /^\s*export\s+default\b/m.test(text);
  const byName =
    /\bexport\s+(?:const|let|var|function)\s+space\b/.test(text) || /\bexport\s*\{[^}]*\bspace\b[^}]*\}/.test(text);

  return byDefault && !byName
    ? [
        finding(
          'space-default-export',
          SPACE_ENTRY,
          `${SPACE_ENTRY} exports the space by default, and it is imported by name — import { space } from './space/index.ts' — so the server's entry point and ${AUTHOR_FILE} find no space.`,
          'Export it as `export const space = …` instead of `export default …`.'
        )
      ]
    : [];
};

/** `.env` with every value taken out — its comments and the names it sets kept: what `.env.example` is made from. */
const emptied = (env: string): string =>
  env
    .split('\n')
    .map(line => line.replace(/^(\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=).*$/, '$1'))
    .join('\n');

/** Settings where Node reads them: `.env` at the root, `.env.example` beside it — and none inside `src/`. */
const envFindings = (root: string): LayoutFinding[] => {
  const atRoot = entriesOf(root).files;
  const hasEnv = atRoot.includes('.env');
  const hasExample = atRoot.includes('.env.example');
  const inSource = filesUnder(root, SOURCE_DIR, new Set(['node_modules'])).filter(
    file => path.posix.basename(file) === '.env'
  );
  // Only one, and none at the root, is moved: two, or one beside the root's, are merged by whoever knows what they set.
  const movable = !hasEnv && inSource.length === 1;
  const misplaced = inSource.map(file =>
    finding(
      'env-in-src',
      file,
      `${file} is never read: Node reads the project's settings from the .env at its root, as its scripts start it (--env-file-if-exists=.env).`,
      movable ? `Move it to the root: mv ${file} .env` : `Copy what it sets into the root's .env, then delete ${file}.`,
      movable ? { action: 'move', from: file, to: '.env' } : undefined
    )
  );
  // One misplaced is said as that: moved, it is the root's.
  const missing =
    hasEnv || misplaced.length > 0
      ? []
      : [
          finding(
            'env-missing',
            '.env',
            '.env is missing at the project’s root: none of its settings is set — the keys and secrets its code reads from process.env.',
            hasExample
              ? 'Copy .env.example and fill it in: cp .env.example .env'
              : 'Write .env with the settings the project reads (process.env.*), and .env.example naming them.',
            hasExample ? { action: 'copy', from: '.env.example', to: '.env' } : undefined
          )
        ];
  const example = hasExample
    ? []
    : [
        finding(
          'env-example-missing',
          '.env.example',
          '.env.example is missing: committed where .env never is, it names the settings .env holds, with no secret in them — so a clone knows what to fill in.',
          hasEnv
            ? 'Write it from .env with every value left empty, and commit it.'
            : 'Write it — each setting the project reads, as KEY= with no value — and commit it.',
          hasEnv
            ? {
                action: 'write',
                file: '.env.example',
                contents: emptied(readFileSync(path.join(root, '.env'), 'utf-8'))
              }
            : undefined
        )
      ];

  return [...misplaced, ...missing, ...example];
};

/** Anything in `src/data/` but JSON: a provider's `/data/<file>` and `ctx.data` read JSON alone. */
const dataFindings = (root: string): LayoutFinding[] =>
  filesUnder(root, DATA_DIR)
    .filter(file => !NOT_SOURCE.has(path.posix.basename(file)) && !file.endsWith('.json'))
    .map(file =>
      finding(
        'data-not-json',
        file,
        `${file} is not JSON: a provider's /data/<file> and ctx.data read JSON files only, and plitzi space push leaves it behind.`,
        `Keep it as JSON (${file.replace(/\.[^./]*$/, '')}.json), or move it out of ${DATA_DIR}/.`
      )
    );

/** A name that says a file holds a secret, a key or a database: never a file to serve. */
const SECRET_NAME =
  /^\.env(?:\..*)?$|\.(?:pem|key|p12|pfx|jks|keystore|sqlite3?|db|sql|dump)$|secret|credential|password|passwd|private[-_.]?key|id_rsa|id_ed25519|service[-_]?account/i;

/**
 * What `public/` serves that had better be kept: files named like a secret, in any project — and, in one with a
 * server, which has a folder of data it never serves, the JSON of `public/data/`.
 */
const publicFindings = (root: string, mode: 'server' | 'client'): LayoutFinding[] => {
  const files = filesUnder(root, PUBLIC_DIR, new Set(['node_modules']));
  const secrets = files
    .filter(file => SECRET_NAME.test(path.posix.basename(file)))
    .map(file =>
      finding(
        'public-secret-file',
        file,
        `${file} is served to anyone who asks, as it is — everything in ${PUBLIC_DIR}/ is on the internet once the project is deployed — and its name says it holds a secret, a key or a database.`,
        `Take it out of ${PUBLIC_DIR}/: settings go in the root's .env${mode === 'server' ? `, data only the server reads in ${DATA_DIR}/` : ''}.`
      )
    );
  const publicData = `${PUBLIC_DIR}/data`;
  const json =
    mode === 'server' ? files.filter(file => file.startsWith(`${publicData}/`) && file.endsWith('.json')) : [];
  const listed = json.slice(0, 3).map(file => path.posix.basename(file));
  const data =
    json.length > 0
      ? [
          finding(
            'public-data',
            `${publicData}/`,
            `${publicData}/ holds ${String(json.length)} JSON file${json.length === 1 ? '' : 's'} (${listed.join(', ')}${json.length > listed.length ? ', …' : ''}), served to anyone who asks: every visitor can read all of ${json.length === 1 ? 'it' : 'them'}, not only what a page shows.`,
            `Data only the server should read goes in ${DATA_DIR}/ — a provider reads it on the server (runtime: 'server', query: '/data/<file>'), a function with ctx.data('<file>'), and neither serves the file. What every visitor may read can stay.`
          )
        ]
      : [];

  return [...secrets, ...data];
};

const dependsOnServer = (root: string): boolean => {
  try {
    const manifest: unknown = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf-8'));

    return (
      isRecord(manifest) &&
      [manifest.dependencies, manifest.devDependencies].some(
        dependencies => isRecord(dependencies) && '@plitzi/sdk-server' in dependencies
      )
    );
  } catch {
    return false;
  }
};

/** What the project is, from its files when not said: a server's dependency; a space folder or the author script. */
const optionsOf = (root: string, options: ProjectLayoutOptions): Required<ProjectLayoutOptions> => ({
  mode: options.mode ?? (dependsOnServer(root) ? 'server' : 'client'),
  space: options.space ?? (exists(root, SPACE_DIR, 'folder') || exists(root, AUTHOR_FILE, 'file') ? 'local' : 'cloud')
});

/**
 * Everything out of place in the project at `root`, errors first: what its server, its authoring and `plitzi doctor`
 * say of its layout. `PROJECT_LAYOUT_CODES` says what each code means.
 */
export const checkProjectLayout = (root: string, options: ProjectLayoutOptions = {}): LayoutFinding[] => {
  const known = optionsOf(root, options);
  const misplaced = nearMissFindings(root, known);
  const findings = [
    ...pluginFindings(root),
    ...sourceEntryFindings(root, {
      folder: FUNCTIONS_DIR,
      accepted: ['index.ts'],
      code: 'functions-entry-missing',
      lost: 'none of the project’s functions runs',
      write: `Write ${FUNCTIONS_DIR}/index.ts exporting defineFunctions({ … }) by default.`
    }),
    ...sourceEntryFindings(root, {
      folder: RUNTIME_DIR,
      accepted: ['index.ts'],
      code: 'runtime-entry-missing',
      lost: 'the space’s runtime does not run',
      write: `Write ${RUNTIME_DIR}/index.ts exporting defineRuntime(…) by default — npx plitzi runtime add writes one.`
    }),
    ...(known.space === 'local' ? spaceFindings(root, misplaced) : []),
    ...misplaced,
    ...envFindings(root),
    ...(known.mode === 'server' ? dataFindings(root) : []),
    ...publicFindings(root, known.mode)
  ];

  return [...findings.filter(each => each.level === 'error'), ...findings.filter(each => each.level === 'warning')];
};

/** One finding as the terminal says it: what is wrong, then what to do. */
export const layoutFindingText = (layoutFinding: LayoutFinding): string =>
  `${layoutFinding.message}\n  → ${layoutFinding.fix}`;

/**
 * The errors of a project's layout, every one at once: what its server and its authoring refuse to start with.
 * `findings` holds them as data, for a tool that says them its own way.
 */
export class ProjectLayoutError extends Error {
  // Off the error's own fields: a process that ends on it prints those beside the message, which says it all.
  readonly #findings: readonly LayoutFinding[];

  get findings(): readonly LayoutFinding[] {
    return this.#findings;
  }

  constructor(findings: readonly LayoutFinding[]) {
    const count = findings.length === 1 ? 'one error' : `${String(findings.length)} errors`;
    const list = findings.map((each, index) => `${String(index + 1)}. ${each.message}\n   → ${each.fix}`).join('\n\n');
    const fixable = findings.filter(each => each.autofix).length;
    const fixed = fixable === findings.length ? 'these fixes' : `${String(fixable)} of these fixes`;
    const doctor =
      fixable > 0
        ? `npx plitzi doctor --fix makes ${fixed} itself.`
        : 'npx plitzi doctor says these with the rest of the project.';
    super(`The project is not laid out as Plitzi reads it — ${count}:\n\n${list}\n\n${doctor}`);
    this.name = 'ProjectLayoutError';
    this.#findings = findings;
  }
}

// A bundler renames a class it inlines (`@plitzi/sdk-authoring` carries this one inside it), and a process that ends on
// the error prints the constructor's name beside its own: `$ [ProjectLayoutError]`.
Object.defineProperty(ProjectLayoutError, 'name', { value: 'ProjectLayoutError' });

/**
 * The project's layout, refused with every error at once (`ProjectLayoutError`) — what its server and its authoring
 * check before anything else — and its warnings answered, for the caller to say.
 */
export const assertProjectLayout = (root: string, options: ProjectLayoutOptions = {}): LayoutFinding[] => {
  const findings = checkProjectLayout(root, options);
  const errors = findings.filter(each => each.level === 'error');
  if (errors.length > 0) {
    throw new ProjectLayoutError(errors);
  }

  return findings;
};
