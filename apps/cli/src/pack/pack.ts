import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { build } from 'esbuild';
import { zipSync } from 'fflate';

import { PLUGIN_FUNCTIONS_SOURCE, readFunctionsSource } from '@plitzi/sdk-shared/actions';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';
import { pluginAssetLoaders, pluginImportQueries } from '@plitzi/sdk-shared/plugins/bundle';
import { inPluginLayer } from '@plitzi/sdk-shared/style/cssLayers';

import { packSource } from './source';
import { emitTypeDeclarations } from './typeDeclarations';

import type { TypesOutcome } from './typeDeclarations';
import type { BuildOptions } from 'esbuild';

/**
 * A plugin built into what a space loads: one ES module, the `plugin-manifest.json` that describes it, and the zip the
 * builder takes under Resources — from the elements of a plugin package, or from element folders of any project.
 *
 * One implementation, here, rather than a build copied into every package: a copy is what went stale in the template
 * this replaced, and the contract it has to keep is the platform's, which moves with the CLI's releases.
 *
 * The contract, enforced rather than described:
 * - React and the SDK are the page's. They stay out of the bundle and are imported from the page — a second React is
 *   "Invalid hook call" and a blank element; a second SDK is an element that cannot see the space it is in.
 * - One file. A page imports the plugin from a blob URL, where a second chunk has nowhere to be found; images and fonts
 *   travel inside it for the same reason.
 * - The manifest describes what was built: each element's declaration, and each file with the hash it has.
 */

/** What the page provides, and the plugin imports rather than carries. */
const EXTERNAL = ['react', 'react-dom', 'react/*', 'react-dom/*', '@plitzi/plitzi-sdk', '@plitzi/plitzi-sdk/*'];

/** Where the elements come from. */
export type PackSource =
  /** A plugin package: its own entry and its own list of declarations, whatever they hold. */
  | { kind: 'package'; entry: string; declarations: string }
  /** Element folders — each holding the `index.ts` and `declaration.ts` an element is made of. The first is the main. */
  | { kind: 'elements'; folders: string[] };

export interface PackOptions {
  /** Where imports resolve from: the package's or the project's root. Nothing is written outside it. */
  root: string;
  source: PackSource;
  /** The name the built files take: `seat-picker` writes `seat-picker.mjs`. */
  base: string;
  version: string;
  /** Emptied, then filled. Must be inside `root`. */
  outDir: string;
  /** Where to write the zip, or nothing for a build alone. */
  zip?: string;
  /**
   * The project its source is kept relative to (docs/en/projects-from-spaces.md): `root` unless the elements are a project of their own inside
   * it — a seeded space in the repository that seeds it.
   */
  sourceRoot?: string;
  /**
   * Write the package's type declarations into `types/`, for a project that installs it. A plugin package's; elements
   * packed out of a project are for the builder, which reads no types.
   */
  types?: boolean;
}

export interface PackResult {
  /** The main element's type: what a space's `plugins` entry names the package by. */
  root: string;
  /** Every element's type, the main one first. */
  types: string[];
  files: string[];
  zip?: string;
  /** Whether the type declarations were written, when they were asked for. */
  typesOutcome?: TypesOutcome;
  /**
   * The source snapshot written beside the zip, for `plitzi upload plugin` to keep on the space — or why there is none:
   * then the plugin is kept built only, and a project taken from the space gets the build, not its source.
   */
  source: { file: string } | { problem: string };
}

/** One built file as a page loads it: its name, what it is, and the hash the browser checks it against. */
interface ManifestAsset {
  src: string;
  type: 'script' | 'style';
  integrity: string;
  isMain: boolean;
}

/** A plugin that cannot be packed, with what to change — never a stack trace out of esbuild. */
export class PackError extends Error {}

/** What the manifest reads of a declaration, checked rather than assumed: it is somebody's file. */
interface Declaration {
  type: string;
  content: {
    attributes: Record<string, unknown>;
    definition: { label: string; description?: string } & Record<string, unknown>;
    builder: Record<string, unknown>;
    market: Record<string, unknown>;
    defaultStyle: Record<string, unknown>;
  };
}

/** The declaration, or what is missing from it — named, so the fix is one edit away. */
const checkDeclaration = (value: unknown, where: string): Declaration => {
  const missing = (field: string) =>
    new PackError(`${where}: the declaration has no ${field}. Write it the way \`plitzi add plugin\` does.`);
  if (!isRecord(value) || typeof value.type !== 'string' || !value.type) {
    throw missing('`type`');
  }

  const { content } = value;
  if (!isRecord(content)) {
    throw missing('`content`');
  }

  for (const field of ['attributes', 'definition', 'builder', 'market', 'defaultStyle']) {
    if (!isRecord(content[field])) {
      throw missing(`\`content.${field}\``);
    }
  }

  if (!isRecord(content.definition) || typeof content.definition.label !== 'string') {
    throw missing('`content.definition.label`');
  }

  // Checked field by field just above; the cast only names the shape those checks established.
  return value as unknown as Declaration;
};

const toImportPath = (file: string): string => file.split(path.sep).join('/');

/** Runs a module esbuild produced, in this process: bundled, it imports nothing it would have to resolve. */
const evaluate = async (code: string): Promise<Record<string, unknown>> =>
  // A module namespace: what it exports is checked by whoever reads it.
  (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)) as Record<string, unknown>;

/**
 * The declarations, read the way the build reads the rest: bundled by esbuild, then run. A declaration is data — it
 * imports types at most — so running it loads no React and touches no DOM.
 */
const readDeclarations = async (root: string, source: PackSource): Promise<Declaration[]> => {
  const contents =
    source.kind === 'package'
      ? `export { declarations } from '${toImportPath(source.declarations)}';`
      : [
          ...source.folders.map(
            (folder, index) => `import d${index} from '${toImportPath(path.join(folder, 'declaration.ts'))}';`
          ),
          `export const declarations = [${source.folders.map((_folder, index) => `d${index}`).join(', ')}];`
        ].join('\n');

  const result = await build({
    stdin: { contents, resolveDir: root, sourcefile: 'plitzi-declarations.ts', loader: 'ts' },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    external: EXTERNAL,
    logLevel: 'silent'
  }).catch((error: unknown) => {
    throw new PackError(
      `The declarations could not be read: ${error instanceof Error ? error.message : String(error)}`
    );
  });

  const { declarations } = await evaluate(result.outputFiles[0].text);
  if (!Array.isArray(declarations) || declarations.length === 0) {
    throw new PackError('No element to pack: the list of declarations is empty.');
  }

  const where = (index: number) =>
    source.kind === 'package'
      ? `${path.relative(root, source.declarations)}[${index}]`
      : path.relative(root, source.folders[index]);
  const checked = declarations.map((declaration, index) => checkDeclaration(declaration, where(index)));
  const types = checked.map(declaration => declaration.type);
  const repeated = types.find((type, index) => types.indexOf(type) !== index);
  if (repeated) {
    throw new PackError(`Two elements are both "${repeated}": a space could not tell them apart.`);
  }

  return checked;
};

/** The entry a space loads: the package's own, or one written for the folders — the first the plugin, the rest its `plugins`. */
const entryOf = (source: PackSource, root: string): Pick<BuildOptions, 'entryPoints' | 'stdin'> =>
  source.kind === 'package'
    ? { entryPoints: [source.entry] }
    : {
        stdin: {
          resolveDir: root,
          contents: [
            ...source.folders.map(
              (folder, index) => `import e${index} from '${toImportPath(path.join(folder, 'index.ts'))}';`
            ),
            'export default e0;',
            `export const plugins = { ${source.folders
              .slice(1)
              .map((_folder, index) => `[e${index + 1}.type]: e${index + 1}`)
              .join(', ')} };`,
            `export const elements = [${source.folders.map((_folder, index) => `e${index}`).join(', ')}];`
          ].join('\n'),
          sourcefile: 'plitzi-plugin.ts',
          loader: 'ts'
        }
      };

const writeTypes = (root: string, outDir: string): TypesOutcome => {
  try {
    return emitTypeDeclarations(root, outDir);
  } catch (error) {
    throw new PackError(
      `The type declarations could not be written: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

const integrityOf = async (file: string): Promise<string> => {
  const content = await fs.readFile(file);

  return `sha384-${createHash('sha384').update(content).digest('base64')}`;
};

/**
 * Where a plugin's server half is: `functions/` in its MAIN element's folder — the first folder packed, or the
 * package's `src/<Main>/`. One per plugin, run as the plugin's (its routes under `/fn/plugins/<type>/`).
 */
const functionsDirOf = (source: PackSource, root: string, mainType: string): string =>
  source.kind === 'package'
    ? path.join(root, 'src', `${mainType.charAt(0).toUpperCase()}${mainType.slice(1)}`, 'functions')
    : path.join(source.folders[0], 'functions');

const hasFunctions = (dir: string): Promise<boolean> =>
  fs
    .access(path.join(dir, 'index.ts'))
    .then(() => true)
    .catch(() => false);

/** Every source file of a server half, by its path inside \`functions/\` — the one rule of what a source is. */
const readFunctions = (dir: string): Promise<Record<string, string>> =>
  readFunctionsSource(dir, {
    list: async folder =>
      (await fs.readdir(folder, { withFileTypes: true })).map(entry => ({
        name: entry.name,
        directory: entry.isDirectory()
      })),
    read: file => fs.readFile(file, 'utf8')
  });

/** The files a plugin is built from: the package's entry, or each element's index — and its server half's. */
const sourceEntries = (source: PackSource, functionsEntry?: string): string[] => [
  ...(source.kind === 'package' ? [source.entry] : source.folders.map(folder => path.join(folder, 'index.ts'))),
  ...(functionsEntry ? [functionsEntry] : [])
];

/** Where the source snapshot of a plugin goes: beside its zip, named after it. */
export const sourceFileOf = (zip: string): string => zip.replace(/\.zip$/, '.source.json.gz');

/**
 * The plugin's source snapshot written beside its zip — or, when it cannot be kept, why: the plugin still packs, and
 * goes up built only.
 */
const writeSource = async (
  name: string,
  source: PackSource,
  root: string,
  zip: string,
  functionsEntry?: string
): Promise<PackResult['source']> => {
  try {
    const { bytes } = await packSource({ root, kind: 'plugin', name, entries: sourceEntries(source, functionsEntry) });
    const file = sourceFileOf(zip);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);

    return { file };
  } catch (error) {
    return { problem: error instanceof Error ? error.message : String(error) };
  }
};

export const packPlugin = async ({
  root,
  source,
  base,
  version,
  outDir,
  zip,
  sourceRoot = root,
  types = false
}: PackOptions): Promise<PackResult> => {
  const relative = path.relative(root, outDir);
  if (relative.startsWith('..') || path.isAbsolute(relative) || relative === '') {
    throw new PackError(`${outDir} is not a folder inside ${root}: the build empties it first, so it has to be.`);
  }

  if (source.kind === 'elements') {
    for (const folder of source.folders) {
      for (const file of ['index.ts', 'declaration.ts']) {
        try {
          await fs.access(path.join(folder, file));
        } catch {
          throw new PackError(
            `${path.relative(root, folder) || folder} has no ${file}: an element is a folder holding its component, ` +
              'declaration and index. `plitzi add plugin` writes one.'
          );
        }
      }
    }
  }

  const declarations = await readDeclarations(root, source);
  const functionsDir = functionsDirOf(source, root, declarations[0].type);
  const functions = (await hasFunctions(functionsDir)) ? await readFunctions(functionsDir) : undefined;
  if (source.kind === 'elements') {
    for (const folder of source.folders.slice(1)) {
      if (await hasFunctions(path.join(folder, 'functions'))) {
        throw new PackError(
          `${path.relative(root, folder)}/functions: a plugin has one server half, its main element's — move it to ` +
            `${path.relative(root, functionsDir)}, its routes and steps named after "${declarations[0].type}".`
        );
      }
    }
  }

  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  await build({
    ...entryOf(source, root),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    minify: true,
    legalComments: 'none',
    // A browser has no `process`: what a dependency reads from it is decided here, once.
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    external: EXTERNAL,
    // Kept inside the one file — a path relative to a blob URL points nowhere: images and fonts, and a file imported
    // whole with `?raw` (a worker's source) or `?inline` (a WebAssembly module).
    loader: pluginAssetLoaders(),
    plugins: [pluginImportQueries()],
    outfile: path.join(outDir, `${base}.mjs`),
    logLevel: 'silent'
  }).catch((error: unknown) => {
    throw new PackError(`The plugin could not be built: ${error instanceof Error ? error.message : String(error)}`);
  });

  const built = (await fs.readdir(outDir)).filter(file => file.endsWith('.mjs') || file.endsWith('.css')).sort();
  // The stylesheet in the plugins' layer, below the space's — before anything is hashed or zipped.
  for (const file of built.filter(name => name.endsWith('.css'))) {
    const css = path.join(outDir, file);
    await fs.writeFile(css, inPluginLayer(await fs.readFile(css, 'utf8')));
  }

  const assets = Object.fromEntries(
    await Promise.all(
      built.map(async (file): Promise<[string, ManifestAsset]> => [
        file,
        {
          src: file,
          type: file.endsWith('.css') ? 'style' : 'script',
          integrity: await integrityOf(path.join(outDir, file)),
          isMain: true
        }
      ])
    )
  );

  const [main] = declarations;
  const { definition, market } = main.content;
  const manifest = {
    root: main.type,
    version,
    author: typeof market.owner === 'string' ? market.owner : '',
    // Whether a plugin is verified is the platform's to say, whatever its declaration claims.
    definition: { name: definition.label, description: definition.description ?? '', ...market, verified: false },
    pluginSchema: Object.fromEntries(
      declarations.map(
        ({
          type,
          content: { attributes, definition: elementDefinition, builder, defaultStyle }
        }): [string, Omit<Declaration['content'], 'market'>] => [
          type,
          { attributes, definition: elementDefinition, builder, defaultStyle }
        ]
      )
    ),
    assets,
    assetsSettings: {},
    // Its server half, as source: built by whatever runs the plugin — the platform on upload, a server of one's own.
    ...(functions ? { functions: PLUGIN_FUNCTIONS_SOURCE } : {})
  };
  await fs.writeFile(path.join(outDir, 'plugin-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  if (functions) {
    const sorted = Object.fromEntries(Object.entries(functions).sort(([a], [b]) => a.localeCompare(b)));
    await fs.writeFile(path.join(outDir, PLUGIN_FUNCTIONS_SOURCE), `${JSON.stringify(sorted, null, 2)}\n`);
  }

  const files = [...built, 'plugin-manifest.json', ...(functions ? [PLUGIN_FUNCTIONS_SOURCE] : [])];
  if (zip) {
    // At the zip's root, as the builder reads it: each file is unpacked beside the others at the plugin's address.
    const entries = await Promise.all(
      files.map(async file => [file, await fs.readFile(path.join(outDir, file))] as const)
    );
    await fs.mkdir(path.dirname(zip), { recursive: true });
    await fs.writeFile(zip, zipSync(Object.fromEntries(entries)));
  }

  // After the zip, which carries what a page loads and not what a compiler reads.
  const typesOutcome = types ? writeTypes(root, outDir) : undefined;

  return {
    root: main.type,
    types: declarations.map(declaration => declaration.type),
    files,
    zip,
    typesOutcome,
    source: await writeSource(
      main.type,
      source,
      sourceRoot,
      zip ?? path.join(outDir, `${base}.zip`),
      functions ? path.join(functionsDir, 'index.ts') : undefined
    )
  };
};
