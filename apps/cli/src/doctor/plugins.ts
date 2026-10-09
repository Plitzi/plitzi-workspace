import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import esbuild from 'esbuild';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';
import { pluginEntry, pluginTypeOf } from '@plitzi/sdk-shared/project/layout';

import { sayer } from './types';
import { PLUGIN_DECLARATION_FILE, PLUGINS_DIR } from '../scaffold/paths';

import type { Check, Finding } from './types';

/**
 * The project's own elements (`src/plugins/<Name>/`) as the server builds them: each folder the layout check finds a
 * plugin — a name that is a type, an entry, what `layout` says of the rest — built as the server builds it, exporting
 * its component, and described by its `declaration.ts`, whose `type` must be the folder's: `StatCard` is `statCard`.
 */

const say = sayer('plugins');

const exists = (file: string): Promise<boolean> =>
  fs.stat(file).then(
    stat => stat.isFile(),
    () => false
  );

const foldersOf = async (dir: string): Promise<string[]> =>
  (await fs.readdir(dir, { withFileTypes: true }).catch(() => []))
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();

/** What the bundler reads as code; any other file a component imports is an asset. */
const CODE = /\.(?:[cm]?[jt]sx?|json)$/;

/**
 * Styles and pictures a component imports are the bundler's to handle — with the queries Vite reads (`./icon.svg?raw`)
 * — so they are read here as nothing: only that the file is there.
 */
const assetsLeftOut: esbuild.Plugin = {
  name: 'plitzi-doctor-assets',
  setup: build => {
    build.onResolve({ filter: /\?/ }, async args => {
      const file = path.resolve(args.resolveDir, args.path.slice(0, args.path.indexOf('?')));

      return (await exists(file))
        ? { path: file, namespace: 'asset' }
        : { errors: [{ text: `Could not resolve "${args.path}"` }] };
    });
    build.onLoad({ filter: /.*/, namespace: 'asset' }, () => ({ contents: '', loader: 'empty' }));
    // esbuild's filters are Go's regular expressions, which look ahead at nothing: the file's kind is told here.
    build.onLoad({ filter: /.*/ }, args =>
      CODE.test(args.path) ? undefined : { contents: '', loader: 'empty' as const }
    );
  }
};

const isMessage = (value: unknown): value is esbuild.Message => isRecord(value) && typeof value.text === 'string';

/** What a failed build says: each of its messages — or, failing in a way that names none, its error, never nothing. */
export const failureOf = (error: unknown): Pick<esbuild.Message, 'text' | 'location'>[] => {
  const messages = isRecord(error) && Array.isArray(error.errors) ? error.errors.filter(isMessage) : [];

  return messages.length > 0
    ? messages
    : [{ text: error instanceof Error ? error.message : String(error), location: null }];
};

/** The `type` a declaration exports by default — or why it gives none. */
const declaredType = async (file: string): Promise<{ type: string } | { problem: string }> => {
  try {
    const loaded: unknown = await import(pathToFileURL(file).href);
    const declaration = isRecord(loaded) ? loaded.default : undefined;

    return isRecord(declaration) && typeof declaration.type === 'string'
      ? { type: declaration.type }
      : { problem: 'exports no declaration by default: `export default { type: …, … }`' };
  } catch (error) {
    return { problem: `does not load: ${error instanceof Error ? error.message : String(error)}` };
  }
};

/** The package an import names: `@plitzi/sdk-elements/x` → `@plitzi/sdk-elements`, `d3/geo` → `d3`. */
const packageOf = (specifier: string): string =>
  specifier
    .split('/')
    .slice(0, specifier.startsWith('@') ? 2 : 1)
    .join('/');

/** A plugin's panel for the builder, as `plugin add` writes it: `Settings.tsx` beside the entry. */
const PANEL_FILE = /^Settings\.[cm]?[jt]sx?$/;

/**
 * Every element has its panel in the builder, even with nothing of its own to set: one without reads "Settings not
 * available", which is what a broken element looks like. Held to what the entry's bundle takes in, since a `Settings.tsx`
 * the entry never imports is no panel either.
 */
const panelFindings = async (root: string, entry: string, inputs: readonly string[]): Promise<Finding[]> => {
  const folder = path.dirname(entry);
  const imported = inputs.some(input => path.dirname(input) === folder && PANEL_FILE.test(path.basename(input)));
  if (imported) {
    return [];
  }

  const written = (await fs.readdir(path.join(root, folder)).catch(() => [])).find(file => PANEL_FILE.test(file));
  if (written) {
    const file = path.join(folder, written);

    return [
      say.warning(
        'plugin-settings-missing',
        `${file} is not part of the plugin: ${entry} never imports it, so the builder has no panel for the element.`,
        {
          file,
          fix: 'Pass it with the component: Object.assign(Component, declaration, { pluginSettings: Settings }).'
        }
      )
    ];
  }

  return [
    say.warning(
      'plugin-settings-missing',
      `${folder} has no Settings.tsx: the builder shows "Settings not available." for the element.`,
      {
        file: entry,
        fix: 'Write one, with a control per attribute (as `plitzi plugin add` does), and pass it as `pluginSettings`.'
      }
    )
  ];
};

/**
 * Whether the plugin builds as the server builds it — for the browser, from the project's own install: every package
 * it imports one `package.json` declares — and exports its component by default. Its files of other kinds (styles,
 * pictures) are the bundler's, not read here.
 */
const builds = async (root: string, entry: string, declared: ReadonlySet<string>): Promise<Finding[]> => {
  const undeclared = new Map<string, string>();
  const packages: esbuild.Plugin = {
    name: 'plitzi-doctor-packages',
    setup: build => {
      build.onResolve({ filter: /^[^./#]/ }, args => {
        if (args.kind !== 'entry-point' && !path.isAbsolute(args.path) && !declared.has(packageOf(args.path))) {
          undeclared.set(packageOf(args.path), path.relative(root, args.importer));
        }

        return args.kind === 'entry-point' ? undefined : { path: args.path, external: true };
      });
    }
  };
  const said = (): Finding[] =>
    [...undeclared].map(([name, importer]) =>
      say.error(
        'undeclared-dependency',
        `${importer} imports ${name}, which package.json does not declare: the server builds the plugin from what the project installs.`,
        { file: importer, fix: `Add ${name} to "dependencies".` }
      )
    );
  let result: esbuild.BuildResult<{ metafile: true; write: false }>;
  try {
    result = await esbuild.build({
      entryPoints: [path.join(root, entry)],
      absWorkingDir: root,
      bundle: true,
      write: false,
      metafile: true,
      format: 'esm',
      platform: 'browser',
      jsx: 'automatic',
      outdir: path.join(root, 'tmp', 'doctor'),
      logLevel: 'silent',
      plugins: [packages, assetsLeftOut]
    });
  } catch (error) {
    const messages = failureOf(error);

    return [
      ...said(),
      ...messages.map(message =>
        say.error('plugin-does-not-build', message.text, {
          file: message.location ? `${message.location.file}:${String(message.location.line)}` : entry
        })
      )
    ];
  }

  const exported = Object.values(result.metafile.outputs).find(output => output.entryPoint === entry)?.exports ?? [];

  return [
    ...said(),
    ...(await panelFindings(root, entry, Object.keys(result.metafile.inputs))),
    ...(exported.includes('default')
      ? []
      : [
          say.error('plugin-no-default', `${entry} exports no component by default: what the server renders.`, {
            file: entry
          })
        ])
  ];
};

const checkFolder = async (root: string, folder: string, packages: ReadonlySet<string>): Promise<Finding[]> => {
  const entry = pluginEntry(root, folder);
  // A folder the server cannot build is the layout check's to say: `plugin-entry-missing`, `plugin-name-invalid`.
  if (!entry) {
    return [];
  }

  const findings = await builds(root, path.relative(root, entry), packages);
  const declarationFile = path.join(PLUGINS_DIR, folder, PLUGIN_DECLARATION_FILE);
  // None is the layout check's warning too (`plugin-declaration-missing`).
  if (!(await exists(path.join(root, declarationFile)))) {
    return findings;
  }

  const declared = await declaredType(path.join(root, declarationFile));
  if ('problem' in declared) {
    return [
      ...findings,
      say.error('plugin-declaration-invalid', `${declarationFile} ${declared.problem}.`, { file: declarationFile })
    ];
  }

  const expected = pluginTypeOf(folder);

  return declared.type === expected
    ? findings
    : [
        ...findings,
        say.error(
          'plugin-type-mismatch',
          `${declarationFile} declares the type ${declared.type}, and the server registers the folder as ${expected}: an element of ${declared.type} renders nothing.`,
          { file: declarationFile, fix: `Declare type: '${expected}', or name the folder after the type.` }
        )
      ];
};

/**
 * Each plugin folder built and declared as the server reads it. Where each is, its entry, the types two folders share,
 * one shadowed by a built copy and the built ones' manifests are the layout check's (`plitzi doctor`'s `layout`).
 */
export const checkPlugins: Check = async ({ root, manifest }) => {
  const declared = new Set([
    ...(isRecord(manifest.dependencies) ? Object.keys(manifest.dependencies) : []),
    ...(isRecord(manifest.devDependencies) ? Object.keys(manifest.devDependencies) : [])
  ]);
  const folders = await foldersOf(path.join(root, PLUGINS_DIR));

  return (await Promise.all(folders.map(folder => checkFolder(root, folder, declared)))).flat();
};
