import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import esbuild from 'esbuild';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { sayer } from './types';
import { PLUGIN_MANIFEST_FILE, PLUGINS_DIR, VENDOR_PLUGINS_DIR } from '../scaffold/paths';

import type { Check, Finding } from './types';

/**
 * The project's own elements (`src/plugins/<Name>/`) as the server finds them: a folder each, registered as its name
 * with a small first letter — `StatCard` is `statCard` — built from its `index.ts`, and described by its
 * `declaration.ts`, whose `type` must be that same name. And the ones it runs as they were built
 * (`vendor/plugins/<type>/`), each beside its manifest.
 */

const say = sayer('plugins');

/** What the server registers a folder as (`serveProject`, `@plitzi/sdk-server/project`). */
export const pluginTypeOf = (folder: string): string => `${folder.charAt(0).toLowerCase()}${folder.slice(1)}`;

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
    ...(exported.includes('default')
      ? []
      : [
          say.error('plugin-no-default', `${entry} exports no component by default: what the server renders.`, {
            file: entry
          })
        ])
  ];
};

const checkFolder = async (
  root: string,
  folder: string,
  packages: ReadonlySet<string>
): Promise<{ findings: Finding[]; type?: string }> => {
  const entry = path.join(PLUGINS_DIR, folder, 'index.ts');
  const declarationFile = path.join(PLUGINS_DIR, folder, 'declaration.ts');
  const expected = pluginTypeOf(folder);
  const findings: Finding[] = [];
  if (await exists(path.join(root, entry))) {
    findings.push(...(await builds(root, entry, packages)));
  } else {
    findings.push(
      say.error(
        'plugin-entry-missing',
        `${PLUGINS_DIR}/${folder}/ has no index.ts: the server registers ${expected} and builds nothing.`,
        {
          file: entry,
          fix: `Write ${entry}, exporting the component by default — or remove the folder.`
        }
      )
    );
  }

  if (!(await exists(path.join(root, declarationFile)))) {
    findings.push(
      say.info(
        'plugin-declaration-missing',
        `${PLUGINS_DIR}/${folder}/ has no declaration.ts: authoring holds none of its attributes to a type, and the builder does not offer it to add.`,
        { file: declarationFile, fix: 'plitzi add plugin writes one; or write it by hand.' }
      )
    );

    return { findings };
  }

  const declared = await declaredType(path.join(root, declarationFile));
  if ('problem' in declared) {
    findings.push(
      say.error('plugin-declaration-invalid', `${declarationFile} ${declared.problem}.`, { file: declarationFile })
    );

    return { findings };
  }

  if (declared.type !== expected) {
    findings.push(
      say.error(
        'plugin-type-mismatch',
        `${declarationFile} declares the type ${declared.type}, and the server registers the folder as ${expected}: an element of ${declared.type} renders nothing.`,
        { file: declarationFile, fix: `Declare type: '${expected}', or name the folder after the type.` }
      )
    );
  }

  return { findings, type: declared.type };
};

const checkVendor = async (root: string): Promise<Finding[]> =>
  (
    await Promise.all(
      (await foldersOf(path.join(root, VENDOR_PLUGINS_DIR))).map(async folder => {
        const file = path.join(VENDOR_PLUGINS_DIR, folder, PLUGIN_MANIFEST_FILE);
        try {
          const manifest: unknown = JSON.parse(await fs.readFile(path.join(root, file), 'utf-8'));

          return isRecord(manifest)
            ? []
            : [
                say.error('vendor-manifest-invalid', `${file} is not a manifest.`, {
                  file,
                  fix: 'plitzi pull brings it again.'
                })
              ];
        } catch {
          return [
            say.error(
              'vendor-manifest-invalid',
              `${file} is missing or not JSON: the built plugin ${folder} does not load.`,
              {
                file,
                fix: 'plitzi pull brings it again.'
              }
            )
          ];
        }
      })
    )
  ).flat();

export const checkPlugins: Check = async ({ root, manifest }) => {
  const folders = await foldersOf(path.join(root, PLUGINS_DIR));
  const declared = new Set([
    ...(isRecord(manifest.dependencies) ? Object.keys(manifest.dependencies) : []),
    ...(isRecord(manifest.devDependencies) ? Object.keys(manifest.devDependencies) : [])
  ]);
  const checked = await Promise.all(folders.map(folder => checkFolder(root, folder, declared)));
  const findings = checked.flatMap(({ findings: found }) => found);
  const byType = new Map<string, string[]>();
  folders.forEach(folder => byType.set(pluginTypeOf(folder), [...(byType.get(pluginTypeOf(folder)) ?? []), folder]));
  for (const [type, named] of byType) {
    if (named.length > 1) {
      findings.push(
        say.error(
          'plugin-type-taken',
          `${named.map(folder => `${PLUGINS_DIR}/${folder}`).join(' and ')} are both ${type}: the server keeps one.`,
          {
            fix: 'Rename one of the folders.'
          }
        )
      );
    }
  }

  const built = await foldersOf(path.join(root, VENDOR_PLUGINS_DIR));
  for (const type of built.filter(each => byType.has(each))) {
    findings.push(
      say.error(
        'plugin-shadowed',
        `${type} is both ${VENDOR_PLUGINS_DIR}/${type} (as it was built) and a folder of ${PLUGINS_DIR}: the server runs the built one, and a change to the source shows nowhere.`,
        {
          file: `${VENDOR_PLUGINS_DIR}/${type}`,
          fix: `Remove ${VENDOR_PLUGINS_DIR}/${type}: the source is the plugin now.`
        }
      )
    );
  }

  return [...findings, ...(await checkVendor(root))];
};
