import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

import { fileImports } from '../pack/source';
import { loadTypeScript } from '../projectTypeScript';
import { exists } from './files';
import { projectPath, under } from './paths';
import { ACTIONS_ENTRY, FUNCTIONS_DIR, PLUGINS_DIR, RUNTIME_ENTRY, SPACE_ENTRY } from '../scaffold/paths';

import type TypeScript from 'typescript';

/**
 * Who owns which file of a project, read off its imports (RFC 0028 §2): one agent per file, and a page is rarely one
 * file — a folder of modules, importing others every page imports.
 *
 * The project's entries (the space's, the actions', the functions', the runtime's) are shared: everything goes through
 * them. Each module an entry imports is a unit — a page, a layout, a component, the tokens — and so is each plugin's
 * folder — whole: a page importing a plugin's declaration reads its contract, it does not share its files. A unit owns
 * the modules only it reaches; a module two units reach is shared, taken by turns or by request. A file no unit reaches
 * (a data file, an image) is a unit of its own.
 */

export const PROJECT_ENTRIES = [SPACE_ENTRY, ACTIONS_ENTRY, `${FUNCTIONS_DIR}/index.ts`, RUNTIME_ENTRY];

export interface Unit {
  /** The module an entry imports, or a plugin's folder (`src/plugins/Map/`). */
  unit: string;
  /** Every file it owns: itself and what only it reaches. */
  owns: string[];
  /** The shared files it reaches. */
  reaches: string[];
}

export interface Ownership {
  units: Unit[];
  entries: string[];
  /** A file only one unit reaches, by its unit. */
  ownerOf: Map<string, string>;
  /** A file several units reach — and every entry — by the units that reach it. */
  shared: Map<string, string[]>;
  /** Who imports each file, by project path: what `plitzi space impact` follows back. */
  importedBy: Map<string, string[]>;
  /** Imports that name a file that is not there, said rather than dropped. */
  missing: string[];
  /**
   * The folders the project loads its pages from by convention (`pagesIn`): a page made in one is imported by being
   * there, and writes no line in an entry.
   */
  pageFolders: string[];
}

const cliRequire = createRequire(import.meta.url);

/** The project's own TypeScript, else the CLI's; refused, with the install, when neither is there. */
const typeScriptFor = (root: string): typeof TypeScript => {
  const own = loadTypeScript(root);
  if (own) {
    return own;
  }

  try {
    // What `require` hands back is the TypeScript module, typed as the project's own import would see it.
    return cliRequire('typescript') as typeof TypeScript;
  } catch {
    throw new Error('Reading who owns which file reads the imports with TypeScript:\n  npm install -D typescript');
  }
};

const pluginFolders = async (root: string): Promise<string[]> => {
  const entries = await fs.readdir(under(root, PLUGINS_DIR), { withFileTypes: true }).catch(() => []);

  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => `${PLUGINS_DIR}/${entry.name}/`)
    .sort();
};

const filesIn = async (root: string, folder: string): Promise<string[]> => {
  const found: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        found.push(projectPath(root, full));
      }
    }
  };
  await walk(under(root, folder));

  return found.sort();
};

export const readOwnership = async (root: string): Promise<Ownership> => {
  const ts = typeScriptFor(root);
  const edges = new Map<string, string[]>();
  const missing: string[] = [];
  const pageFolders = new Set<string>();

  const importsOf = async (file: string): Promise<string[]> => {
    const known = edges.get(file);
    if (known) {
      return known;
    }

    const text = await fs.readFile(under(root, file), 'utf-8').catch(() => undefined);
    if (text === undefined) {
      edges.set(file, []);

      return [];
    }

    const imports = await fileImports(ts, under(root, file), text);
    const inside = imports.files
      .map(found => projectPath(root, found))
      .filter(found => !found.startsWith('..') && !path.isAbsolute(found));
    missing.push(...imports.missing.map(raw => `${file} imports "${raw}", which is not there`));
    imports.pageFolders.forEach(folder => pageFolders.add(projectPath(root, folder)));
    edges.set(file, inside);

    return inside;
  };

  const entries: string[] = [];
  for (const entry of PROJECT_ENTRIES) {
    if (await exists(under(root, entry))) {
      entries.push(entry);
    }
  }

  const entrySet = new Set(entries);
  const starts = new Map<string, string[]>();
  for (const entry of entries) {
    for (const imported of await importsOf(entry)) {
      if (!entrySet.has(imported) && !imported.startsWith(PLUGINS_DIR)) {
        starts.set(imported, [imported]);
      }
    }
  }

  for (const folder of await pluginFolders(root)) {
    starts.set(folder, await filesIn(root, folder));
  }

  const reachedBy = new Map<string, Set<string>>();
  const reach = (file: string, unit: string): void => {
    const units = reachedBy.get(file) ?? new Set<string>();
    units.add(unit);
    reachedBy.set(file, units);
  };

  const plugins = [...starts.keys()].filter(unit => unit.endsWith('/'));
  // A plugin's folder is its own, whoever imports from it: a page that imports its declaration reads a contract.
  const inOtherPlugin = (file: string, unit: string): boolean =>
    plugins.some(folder => folder !== unit && file.startsWith(folder));
  for (const [unit, files] of starts) {
    const seen = new Set<string>();
    const queue = [...files];
    while (queue.length > 0) {
      const file = queue.shift();
      if (file === undefined || seen.has(file) || inOtherPlugin(file, unit)) {
        continue;
      }

      seen.add(file);
      reach(file, unit);
      if (entrySet.has(file)) {
        continue;
      }

      queue.push(...(await importsOf(file)));
    }
  }

  const ownerOf = new Map<string, string>();
  const shared = new Map<string, string[]>();
  for (const [file, units] of reachedBy) {
    if (entrySet.has(file)) {
      continue;
    }

    const list = [...units].sort();
    if (list.length === 1) {
      ownerOf.set(file, list[0]);
    } else {
      shared.set(file, list);
    }
  }

  for (const entry of entries) {
    shared.set(entry, [...(reachedBy.get(entry) ?? [])].sort());
  }

  const importedBy = new Map<string, string[]>();
  for (const [file, imports] of edges) {
    for (const imported of imports) {
      importedBy.set(imported, [...(importedBy.get(imported) ?? []), file]);
    }
  }

  const units: Unit[] = [...starts.keys()].sort().map(unit => ({
    unit,
    owns: [...ownerOf]
      .filter(([, owner]) => owner === unit)
      .map(([file]) => file)
      .sort(),
    reaches: [...shared]
      .filter(([, by]) => by.includes(unit))
      .map(([file]) => file)
      .sort()
  }));

  return {
    units,
    entries,
    ownerOf,
    shared,
    importedBy,
    missing: [...new Set(missing)].sort(),
    pageFolders: [...pageFolders].sort()
  };
};

/** Whether `file` is a page of a folder the project loads its pages from: itself in it, or a folder's index there. */
export const inPageFolder = (ownership: Ownership, file: string): boolean =>
  ownership.pageFolders.some(folder => {
    const rest = file.startsWith(`${folder}/`) ? file.slice(folder.length + 1).split('/') : [];

    return rest.length === 1 || (rest.length === 2 && /^index\.[cm]?[jt]sx?$/.test(rest[1]));
  });

/** The files a task writes when it names `files`: each unit it names brings what that unit owns. */
export const expandFiles = (ownership: Ownership, files: readonly string[]): string[] => {
  const expanded = new Set<string>();
  for (const file of files) {
    // A plugin's folder is named with or without its last slash.
    const unit = ownership.units.find(each => each.unit === file || each.unit === `${file}/`);
    if (unit) {
      unit.owns.forEach(owned => expanded.add(owned));
    }

    // The file named is the task's whatever else it brings — a unit others reach too (a layout, the theme) owns nothing
    // only it reaches, and the task still writes the file itself. A plugin's folder is its files, not itself.
    if (!unit?.unit.endsWith('/')) {
      expanded.add(file);
    }
  }

  return [...expanded].sort();
};

/** The shared files the units `files` names reach: what a task of them will want by turns or by request. */
export const sharedReached = (ownership: Ownership, files: readonly string[]): string[] =>
  [
    ...new Set(
      ownership.units
        .filter(unit => files.includes(unit.unit) || files.includes(unit.unit.replace(/\/$/, '')))
        .flatMap(unit => unit.reaches)
    )
  ].sort();

/** What depends on `file`, all the way back: the files that import it, and theirs, to the entries. */
export const impactOf = (ownership: Ownership, file: string): { files: string[]; units: string[] } => {
  const seen = new Set<string>();
  const queue = [...(ownership.importedBy.get(file) ?? [])];
  while (queue.length > 0) {
    const next = queue.shift();
    if (next === undefined || seen.has(next)) {
      continue;
    }

    seen.add(next);
    queue.push(...(ownership.importedBy.get(next) ?? []));
  }

  const units = new Set<string>([...(ownership.shared.get(file) ?? [])]);
  const owner = ownership.ownerOf.get(file);
  if (owner) {
    units.add(owner);
  }

  return { files: [...seen].sort(), units: [...units].sort() };
};
