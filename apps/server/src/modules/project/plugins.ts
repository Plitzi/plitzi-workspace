import { existsSync, readdirSync, readFileSync, watch } from 'node:fs';
import path from 'node:path';

import { PLUGIN_FUNCTIONS_SOURCE } from '@plitzi/sdk-shared/actions';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';
import {
  checkPluginFolder,
  layoutFindingText,
  pluginEntry,
  pluginTypeOf,
  readVendorPlugin
} from '@plitzi/sdk-shared/project/layout';
import { PLUGIN_FUNCTIONS_DIR, PLUGINS_DIR, VENDOR_PLUGINS_DIR } from '@plitzi/sdk-shared/project/paths';

import { loadFunctions, loadFunctionsSource } from '../functions/load';

import type { FunctionsDefinition } from '../functions/contract';
import type { PluginSource, SSRServer } from '@plitzi/sdk-shared';

/**
 * A project's plugins, as its server registers them: every folder of `src/plugins` built from its source, and every
 * plugin of `vendor/plugins` run as it was built — each with its server half, when it has one.
 */
export type ProjectPlugins = {
  /** How each is built, by the type a space's element of it is — `defineElement(declaration)` — rendered by. */
  sources: Record<string, PluginSource>;
  /**
   * Which of them the space renders with — the deployment's `pluginNames`. Registering a plugin is not turning it on:
   * a server can host many spaces, and nothing hands it this list on its own. Changed in place while developing, as
   * folders come and go, so the deployment holding it renders with them.
   */
  names: string[];
  /** Their server halves, by plugin name: `functions.plugins`. */
  functions: Record<string, FunctionsDefinition>;
  /** The names that are folders of `src/plugins`: the only ones a folder coming or going turns on or off. */
  fromFolders: Set<string>;
};

/**
 * `action: 'compile'` is what makes a folder's plugin SERVER-rendered: the server builds the entry with esbuild, keeps
 * React external so the plugin runs on the one copy the page already has, serves the bundle to the browser AND
 * imports it into the render — so the component's markup is in the HTML before any JavaScript arrives.
 */
const folderSource = (entry: string): PluginSource => ({ js: entry, action: 'compile', version: '1.0.0' });

const foldersOf = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .sort()
    : [];

/** Every folder of `src/plugins` the server can build, by the plugin it is: what it registers. */
const pluginFolders = (root: string): Map<string, { folder: string; entry: string }> => {
  const found = new Map<string, { folder: string; entry: string }>();
  for (const folder of foldersOf(path.join(root, PLUGINS_DIR))) {
    const entry = pluginEntry(root, folder);
    // Two folders of one type are refused at boot; one added while developing leaves the first registered.
    if (entry && !found.has(pluginTypeOf(folder))) {
      found.set(pluginTypeOf(folder), { folder, entry });
    }
  }

  return found;
};

/**
 * A plugin's server half: its `functions/` folder (`src/plugins/Board/functions/index.ts`), written like the project's
 * own `src/functions/` and loaded with what a plugin may reach — its own corner of `kv`, its routes under
 * `/fn/plugins/<name>/`, its tasks named `<name>.<action>`. A folder without one is a component and nothing else; one
 * with code and no `index.ts` is the layout check's to say (`plugin-functions-entry-missing`).
 */
const folderFunctions = async (root: string, folder: string): Promise<FunctionsDefinition | undefined> => {
  const functions = path.join(root, PLUGINS_DIR, folder, PLUGIN_FUNCTIONS_DIR);

  return existsSync(path.join(functions, 'index.ts')) ? (await loadFunctions(functions)).at(0) : undefined;
};

type BuiltPlugin = { type: string; source: PluginSource; functions?: string };

/** A plugin of `vendor/plugins`, from the manifest `plitzi plugin pack` wrote beside its bundle when it was published. */
const builtPlugin = (root: string, type: string): BuiltPlugin => {
  const read = readVendorPlugin(root, type);
  // The layout check refused the boot over one that does not read: this is a project changed since it passed.
  if ('problem' in read) {
    throw new Error(read.problem.message);
  }

  return {
    type,
    source: {
      js: read.script,
      ...(read.style ? { css: read.style } : {}),
      action: 'copy',
      version: read.version
    },
    // Its server half, as it was packed: the source, built and loaded here like a folder's.
    ...(read.functions ? { functions: read.functions } : {})
  };
};

/** The files of a packed plugin's server half (`functions.source.json`), by their path. */
const carriedSource = (file: string): Record<string, string> => {
  const carried: unknown = JSON.parse(readFileSync(file, 'utf-8'));
  const files = isRecord(carried)
    ? Object.entries(carried).flatMap(([name, text]) => (typeof text === 'string' ? [[name, text] as const] : []))
    : [];
  if (!isRecord(carried) || files.length !== Object.keys(carried).length) {
    throw new Error(
      `${file} is not a plugin's server half: ${PLUGIN_FUNCTIONS_SOURCE} maps each file's path to its text.`
    );
  }

  return Object.fromEntries(files);
};

/** Every plugin of the project at `root`, as its server registers them at boot. */
export const projectPlugins = async (root: string): Promise<ProjectPlugins> => {
  const folders = pluginFolders(root);
  const sources: Record<string, PluginSource> = Object.fromEntries(
    [...folders].map(([name, { entry }]) => [name, folderSource(entry)])
  );
  const functions: Record<string, FunctionsDefinition> = {};
  for (const [name, { folder }] of folders) {
    const definition = await folderFunctions(root, folder);
    if (definition) {
      functions[name] = definition;
    }
  }

  // None in most projects: a project made from a space whose plugins kept no source.
  const built = foldersOf(path.join(root, VENDOR_PLUGINS_DIR)).map(type => builtPlugin(root, type));
  for (const { type, source, functions: carried } of built) {
    sources[type] = source;
    if (carried) {
      const definition = (await loadFunctionsSource(carriedSource(carried))).at(0);
      if (definition) {
        functions[type] = definition;
      }
    }
  }

  return {
    sources,
    names: Object.keys(sources),
    functions,
    fromFolders: new Set(folders.keys())
  };
};

/**
 * A plugin edited while developing is built again by the server, and the open pages swap it where it is drawn — the
 * rest of the page, its state included, stays as it was (`devReload`). Its server half (`functions/`) is loaded again
 * here, in place. A plugin ADDED — a new folder with an `index.ts`, what `plitzi plugin add` writes — is registered
 * here, and the pages load again to render it; one removed is turned off. A folder the server cannot build, or whose
 * server half has no entry, is said in the terminal as the layout check says it at boot — once, until it changes — and
 * the server goes on. Answers what stops watching.
 */
export const watchProjectPlugins = (root: string, server: SSRServer, plugins: ProjectPlugins): (() => void) => {
  const dir = path.join(root, PLUGINS_DIR);
  if (!existsSync(dir)) {
    return () => undefined;
  }

  const { names, fromFolders } = plugins;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const reloading = new Map<string, ReturnType<typeof setTimeout>>();
  /** What was said of each folder last — at boot, by the layout check — so a save says only what changed. */
  const said = new Map(
    foldersOf(dir).map(folder => [folder, checkPluginFolder(root, folder).map(layoutFindingText).join('\n')])
  );
  const sayOf = (folder: string): void => {
    const findings = checkPluginFolder(root, folder);
    const text = findings.map(layoutFindingText).join('\n');
    if (text === (said.get(folder) ?? '')) {
      return;
    }

    said.set(folder, text);
    for (const finding of findings) {
      const line = `[plugins] ${layoutFindingText(finding)}`;
      if (finding.level === 'error') {
        console.error(line);
      } else {
        console.warn(line);
      }
    }
  };
  const reloadFunctions = (folder: string): void => {
    const name = pluginTypeOf(folder);
    sayOf(folder);
    folderFunctions(root, folder)
      .then(definition => {
        server.functions.setPlugin(name, definition);
        // A plugin with no server half has nothing loaded to say.
        if (definition) {
          console.log(`[plugins] ${name}: its functions, loaded again`);
        }
      })
      .catch((error: unknown) => {
        console.error(
          `[plugins] ${name}: its functions were not loaded again:`,
          error instanceof Error ? error.message : error
        );
      });
  };
  const sync = (): void => {
    const folders = foldersOf(dir);
    folders.forEach(sayOf);
    for (const folder of [...said.keys()].filter(each => !folders.includes(each))) {
      said.delete(folder);
    }

    const present = pluginFolders(root);
    const added = [...present].filter(([name]) => !fromFolders.has(name));
    const removed = [...fromFolders].filter(name => !present.has(name));
    for (const [name, { folder, entry }] of added) {
      server.plugins.register(name, folderSource(entry));
      fromFolders.add(name);
      names.push(name);
      reloadFunctions(folder);
    }

    for (const name of removed) {
      fromFolders.delete(name);
      names.splice(names.indexOf(name), 1);
      server.functions.setPlugin(name, undefined);
    }

    if (added.length > 0 || removed.length > 0) {
      server.reloadPages();
    }
  };

  const watcher = watch(dir, { recursive: true }, (_event, file) => {
    // `Board/functions/index.ts`: a plugin's server half changed, and is loaded again on its own.
    const [folder, part] = (file ?? '').split(path.sep);
    if (folder && part === PLUGIN_FUNCTIONS_DIR && fromFolders.has(pluginTypeOf(folder))) {
      clearTimeout(reloading.get(folder));
      reloading.set(
        folder,
        setTimeout(() => reloadFunctions(folder), 200)
      );

      return;
    }

    clearTimeout(timer);
    timer = setTimeout(sync, 300);
  });

  return () => {
    clearTimeout(timer);
    reloading.forEach(clearTimeout);
    watcher.close();
  };
};
