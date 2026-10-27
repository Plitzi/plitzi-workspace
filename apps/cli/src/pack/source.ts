import fs from 'node:fs/promises';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { pageModulesIn } from '@plitzi/sdk-shared/project/pages';
import { readSourceSnapshot, SOURCE_SNAPSHOT_FORMAT } from '@plitzi/sdk-shared/source';

import { nearestPackage, readPackageJson } from '../commands/existingProject';
import { loadTypeScript } from '../projectTypeScript';

import type { SourceSnapshot, SourceSnapshotKind } from '@plitzi/sdk-shared/source';
import type TypeScript from 'typescript';

/**
 * A source snapshot packed from a project: the files an artifact is built from, found by following its imports from its
 * entries — what `plitzi plugin upload` and `plitzi space push runtime` send beside what they built, so the platform can hand
 * the space back as a project (`plitzi create --from`).
 *
 * Imports are read with the project's own TypeScript, never by building: a bundler drops `import type`, and a file only
 * its types are imported from is still a file the project needs to compile.
 */

export type PackSourceInput = {
  /** The project's root: paths in the snapshot are relative to it, and nothing outside it may be reached. */
  root: string;
  kind: SourceSnapshotKind;
  name: string;
  /** The files the build starts from, absolute. */
  entries: string[];
};

const CODE = /\.(m|c)?(t|j)sx?$/;

const STYLES = /\.(css|scss|sass|less)$/;

/** Where an import of a file without its extension can be, in the order a bundler looks. */
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.scss'];

const BUILTINS = new Set(builtinModules);

const isFile = async (file: string): Promise<boolean> => {
  try {
    return (await fs.stat(file)).isFile();
  } catch {
    return false;
  }
};

/**
 * The file a relative import names, as a bundler finds it: as written, with an extension added, the TypeScript file a
 * `.js` import stands for, or a folder's index.
 */
const resolveFile = async (from: string, specifier: string): Promise<string | undefined> => {
  const target = path.resolve(path.dirname(from), specifier);
  const swapped = /\.(m|c)?jsx?$/.test(target) ? [target.replace(/\.(m|c)?js(x?)$/, '.$1ts$2')] : [];
  const candidates = [
    target,
    ...swapped,
    ...EXTENSIONS.map(extension => `${target}${extension}`),
    ...EXTENSIONS.map(extension => path.join(target, `index${extension}`))
  ];
  for (const candidate of candidates) {
    if (await isFile(candidate)) {
      return candidate;
    }
  }

  return undefined;
};

/** A package's name from what an import asks for: `@scope/name/sub` is `@scope/name`, `name/sub` is `name`. */
const packageOf = (specifier: string): string =>
  specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];

/** What a stylesheet brings in: its `@import`s and the files its `url()`s point at — not a data URI or an address. */
const styleImports = (text: string): string[] =>
  [...text.matchAll(/@import\s+(?:url\()?\s*['"]([^'"]+)['"]/g), ...text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)]
    .map(match => match[1].trim())
    .filter(specifier => !/^(data:|https?:|\/\/|#)/.test(specifier));

const codeImports = (ts: typeof TypeScript, text: string): string[] =>
  ts.preProcessFile(text, true, true).importedFiles.map(file => file.fileName);

/** `import.meta.url`, as written. */
const isImportMetaUrl = (ts: typeof TypeScript, node: TypeScript.Node): boolean =>
  ts.isPropertyAccessExpression(node) &&
  node.name.text === 'url' &&
  ts.isMetaProperty(node.expression) &&
  node.expression.keywordToken === ts.SyntaxKind.ImportKeyword;

/**
 * The folders a module loads its pages from by convention — `pagesIn(new URL('./pages/', import.meta.url))`,
 * `@plitzi/sdk-authoring/node` — absolute: each page module in them is imported though no `import` names it. A folder
 * given any other way (a variable, a path from the working directory) cannot be read without running the module, and
 * is not followed.
 */
export const pageFolderLoads = (ts: typeof TypeScript, file: string, text: string): string[] => {
  if (!text.includes('pagesIn')) {
    return [];
  }

  const folders: string[] = [];
  const visit = (node: TypeScript.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : '';
      const where = node.arguments.at(0);
      if (
        name === 'pagesIn' &&
        where !== undefined &&
        ts.isNewExpression(where) &&
        ts.isIdentifier(where.expression) &&
        where.expression.text === 'URL'
      ) {
        const relative = where.arguments?.at(0);
        const base = where.arguments?.at(1);
        if (
          relative !== undefined &&
          base !== undefined &&
          ts.isStringLiteralLike(relative) &&
          isImportMetaUrl(ts, base)
        ) {
          folders.push(path.resolve(path.dirname(file), relative.text));
        }
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true));

  return [...new Set(folders)];
};

export interface FileImports {
  /** The project files it imports, absolute, as a bundler finds them — the page modules of a folder it loads too. */
  files: string[];
  /** The folders it loads its pages from (`pagesIn`), absolute: a page made there is imported by being there. */
  pageFolders: string[];
  /** What it imports that is not there, as written. */
  missing: string[];
  /** The packages it imports, by name — not Node's own. */
  packages: string[];
}

/** What one file imports — read with TypeScript for code, from `@import` and `url()` for a stylesheet. */
export const fileImports = async (ts: typeof TypeScript, file: string, text: string): Promise<FileImports> => {
  let specifiers: string[] = [];
  const pageFolders = CODE.test(file) ? pageFolderLoads(ts, file, text) : [];
  if (CODE.test(file)) {
    specifiers = codeImports(ts, text);
  } else if (STYLES.test(file)) {
    specifiers = styleImports(text);
  }

  const imports: FileImports = {
    files: pageFolders.flatMap(folder => pageModulesIn(folder)),
    pageFolders,
    missing: [],
    packages: []
  };
  for (const raw of specifiers) {
    // A bundler's query (`?raw`, `?url`) or a fragment says how to load a file, not which one.
    const specifier = raw.replace(/[?#].*$/, '');
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      const found = await resolveFile(file, specifier);
      if (found) {
        imports.files.push(found);
      } else {
        imports.missing.push(raw);
      }

      continue;
    }

    if (!specifier.startsWith('node:') && !BUILTINS.has(specifier)) {
      imports.packages.push(packageOf(specifier));
    }
  }

  return imports;
};

/** A file's path in the snapshot: relative to the root, with forward slashes whatever the system writes. */
const projectPath = (root: string, file: string): string => path.relative(root, file).split(path.sep).join('/');

/** The package of type declarations TypeScript reads for `name`: `geojson` is `@types/geojson`, `@a/b` is `@types/a__b`. */
const typesPackageOf = (name: string): string =>
  `@types/${name.startsWith('@') ? name.slice(1).replace('/', '__') : name}`;

/**
 * The package an import needs, and the range the project asks for it: itself, or — for an import only its types are
 * read from (`import type { Feature } from 'geojson'`) — the package of its declarations.
 */
const dependencyOf = async (root: string, name: string): Promise<[string, string] | undefined> => {
  const manifestDir = await nearestPackage(root);
  const manifest = manifestDir ? await readPackageJson(manifestDir) : undefined;
  const rangeOf = (dependency: string): string | undefined =>
    manifest?.dependencies?.[dependency] ??
    manifest?.devDependencies?.[dependency] ??
    manifest?.peerDependencies?.[dependency];
  const range = rangeOf(name);
  if (range) {
    return [name, range];
  }

  const types = typesPackageOf(name);
  const typesRange = rangeOf(types);

  return typesRange ? [types, typesRange] : undefined;
};

/**
 * The snapshot of what `entries` reach, gzipped as it travels, and as read. Refused, every reason at once, when an
 * import leaves the project, names a file that is not there or a package the project does not declare, or a file it
 * reaches holds a credential.
 */
export const packSource = async ({
  root,
  kind,
  name,
  entries
}: PackSourceInput): Promise<{ snapshot: SourceSnapshot; bytes: Uint8Array }> => {
  const ts = loadTypeScript(root);
  if (!ts) {
    throw new Error(
      'Packing the source reads its imports with the project’s own TypeScript:\n  npm install -D typescript'
    );
  }

  const problems: string[] = [];
  const files: Record<string, string> = {};
  const packages = new Set<string>();
  const queue = entries.map(entry => path.resolve(entry));
  const seen = new Set<string>();
  while (queue.length > 0) {
    const file = queue.shift();
    if (file === undefined || seen.has(file)) {
      continue;
    }

    seen.add(file);
    const relative = projectPath(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      problems.push(`${relative} is outside the project (${root}): a project's source is the files inside it`);
      continue;
    }

    const bytes = await fs.readFile(file);
    files[relative] = bytes.toString('base64');
    const imports = await fileImports(ts, file, bytes.toString('utf-8'));
    queue.push(...imports.files);
    problems.push(...imports.missing.map(raw => `${relative} imports "${raw}", which is not there`));
    imports.packages.forEach(name => packages.add(name));
  }

  const dependencies: Record<string, string> = {};
  for (const dependency of [...packages].sort()) {
    const found = await dependencyOf(root, dependency);
    if (found) {
      dependencies[found[0]] = found[1];
    } else {
      problems.push(`It imports "${dependency}", which the project's package.json does not list`);
    }
  }

  const snapshot: SourceSnapshot = {
    format: SOURCE_SNAPSHOT_FORMAT,
    kind,
    name,
    entries: entries.map(entry => projectPath(root, path.resolve(entry))),
    files,
    dependencies
  };
  const reading = readSourceSnapshot(snapshot, base64 => Buffer.from(base64, 'base64').toString('utf-8'));
  problems.push(...(reading.ok ? [] : reading.problems));
  if (problems.length > 0) {
    throw new Error(`The source of ${name} cannot be kept:\n${problems.map(problem => `  - ${problem}`).join('\n')}`);
  }

  return { snapshot, bytes: new Uint8Array(gzipSync(JSON.stringify(snapshot))) };
};
