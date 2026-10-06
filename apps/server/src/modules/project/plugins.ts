import { existsSync, readdirSync, readFileSync, watch } from 'node:fs';
import path from 'node:path';

import { PLUGIN_FUNCTIONS_SOURCE } from '@plitzi/sdk-shared/actions';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';
import { PLUGIN_MANIFEST_FILE, PLUGINS_DIR, VENDOR_PLUGINS_DIR } from '@plitzi/sdk-shared/project/paths';

import { loadFunctions, loadFunctionsSource } from '../functions/load';

import type { FunctionsDefinition } from '../functions/contract';
import type { PluginSource, SSRServer } from '@plitzi/sdk-shared';

/**
 * A project's plugins, as its server registers them: every folder of `src/plugins` built from its source, and every
 * plugin of `vendor/plugins` run as it was built — each with its server half, when it has one.
 */
export type ProjectPlugins = {
  /** How each is built, by the name a space's `custom({ renderType })` renders it by. */
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

/** `src/plugins/StatCard` is the plugin `statCard`. */
const pluginName = (folder: string): string => `${folder.charAt(0).toLowerCase()}${folder.slice(1)}`;

/**
 * `action: 'compile'` is what makes a folder's plugin SERVER-rendered: the server builds the entry with esbuild, keeps
 * React external so the plugin runs on the one copy the page already has, serves the bundle to the browser AND
 * imports it into the render — so the component's markup is in the HTML before any JavaScript arrives.
 */
const folderSource = (dir: string, folder: string): PluginSource => ({
  js: path.join(dir, folder, 'index.ts'),
  action: 'compile',
  version: '1.0.0'
});

const foldersOf = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
    : [];

/**
 * A plugin's server half: its `functions/` folder (`src/plugins/Board/functions/index.ts`), written like the project's
 * own `src/functions/` and loaded with what a plugin may reach — its own corner of `kv`, its routes under
 * `/fn/plugins/<name>/`, its tasks named `<name>.<action>`. A folder without one is a component and nothing else.
 */
const folderFunctions = async (dir: string, folder: string): Promise<FunctionsDefinition | undefined> => {
  const functions = path.join(dir, folder, 'functions');

  return existsSync(path.join(functions, 'index.ts')) ? (await loadFunctions(functions)).at(0) : undefined;
};

type BuiltPlugin = { type: string; source: PluginSource; functions?: string };

type ManifestAsset = { src: string; type: string; isMain: boolean };

const assetsOf = (manifest: Record<string, unknown>): ManifestAsset[] =>
  isRecord(manifest.assets)
    ? Object.values(manifest.assets).flatMap(asset =>
        isRecord(asset) && typeof asset.src === 'string' && typeof asset.type === 'string'
          ? [{ src: asset.src, type: asset.type, isMain: asset.isMain === true }]
          : []
      )
    : [];

/** A plugin of `vendor/plugins`, from the manifest `plitzi pack plugin` wrote beside its bundle when it was published. */
const builtPlugin = (dir: string, type: string): BuiltPlugin => {
  const at = path.join(dir, type);
  const manifest: unknown = JSON.parse(readFileSync(path.join(at, PLUGIN_MANIFEST_FILE), 'utf-8'));
  const read = isRecord(manifest) ? manifest : {};
  const assets = assetsOf(read);
  const script =
    assets.find(asset => asset.type === 'script' && asset.isMain) ?? assets.find(asset => asset.type === 'script');
  const style = assets.find(asset => asset.type === 'style');
  if (!script) {
    throw new Error(`${VENDOR_PLUGINS_DIR}/${type}/${PLUGIN_MANIFEST_FILE} names no script to run.`);
  }

  return {
    type,
    source: {
      js: path.join(at, script.src),
      ...(style ? { css: path.join(at, style.src) } : {}),
      action: 'copy',
      version: typeof read.version === 'string' ? read.version : '1.0.0'
    },
    // Its server half, as it was packed: the source, built and loaded here like a folder's.
    ...(typeof read.functions === 'string' ? { functions: path.join(at, read.functions) } : {})
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
  const dir = path.join(root, PLUGINS_DIR);
  const folders = foldersOf(dir);
  const sources: Record<string, PluginSource> = Object.fromEntries(
    folders.map(folder => [pluginName(folder), folderSource(dir, folder)])
  );
  const functions: Record<string, FunctionsDefinition> = {};
  for (const folder of folders) {
    const definition = await folderFunctions(dir, folder);
    if (definition) {
      functions[pluginName(folder)] = definition;
    }
  }

  // None in most projects: a project made from a space whose plugins kept no source.
  const vendor = path.join(root, VENDOR_PLUGINS_DIR);
  const built = foldersOf(vendor).map(type => builtPlugin(vendor, type));
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
    fromFolders: new Set(folders.map(pluginName))
  };
};

/**
 * A plugin edited while developing is built again by the server, and the open pages swap it where it is drawn — the
 * rest of the page, its state included, stays as it was (`devReload`). Its server half (`functions/`) is loaded again
 * here, in place. A plugin ADDED — a new folder with an `index.ts`, what `plitzi add plugin` writes — is registered
 * here, and the pages load again to render it; one removed is turned off. Answers what stops watching.
 */
export const watchProjectPlugins = (root: string, server: SSRServer, plugins: ProjectPlugins): (() => void) => {
  const dir = path.join(root, PLUGINS_DIR);
  if (!existsSync(dir)) {
    return () => undefined;
  }

  const { names, fromFolders } = plugins;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const reloading = new Map<string, ReturnType<typeof setTimeout>>();
  const reloadFunctions = (folder: string): void => {
    const name = pluginName(folder);
    folderFunctions(dir, folder)
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
    // Name → folder, for every folder that is a plugin now.
    const present = new Map(
      foldersOf(dir)
        .filter(folder => existsSync(path.join(dir, folder, 'index.ts')))
        .map(folder => [pluginName(folder), folder])
    );
    const added = [...present].filter(([name]) => !fromFolders.has(name));
    const removed = [...fromFolders].filter(name => !present.has(name));
    for (const [name, folder] of added) {
      server.plugins.register(name, folderSource(dir, folder));
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
    if (folder && part === 'functions' && fromFolders.has(pluginName(folder))) {
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
