import path from 'node:path';

import esbuild from 'esbuild';

import { exportsByDefault, isFunctionsDefinitionFile, isFunctionsSourcePath } from '@plitzi/sdk-shared/actions';

import { ActionRefusal, defineFunctions } from './contract';

import type { FunctionsDefinition } from './contract';
import type { FunctionsProblem } from '@plitzi/sdk-shared';

/** A space's functions source: its files under `functions/`, by path (`index.ts`, `lib/feed.ts`). */
export type FunctionsSource = Record<string, string>;

/** One bundle, built from a source: a single web-standard ES module whose default export is the definition. */
export type FunctionsBuild = { code: string; bytes: number };

export class FunctionsBuildError extends Error {
  readonly problems: FunctionsProblem[];

  constructor(problems: FunctionsProblem[]) {
    super(
      problems.map(({ file, line, message }) => (file ? `${file}:${String(line ?? 0)} ${message}` : message)).join('\n')
    );
    this.name = 'FunctionsBuildError';
    this.problems = problems;
  }
}

/**
 * The definitions of `files`, merged into one — what a bundle exports by default. Printed into the bundle from itself,
 * so it uses nothing outside: two tasks of one id or two routes of one path are refused, naming both files; the hosts
 * code may reach are every file's together; a file whose default export is not a definition is no definition.
 */
export const mergeFunctions = (files: [string, unknown][]): FunctionsDefinition => {
  const isDefinition = (value: unknown): value is FunctionsDefinition =>
    typeof value === 'object' &&
    value !== null &&
    ['tasks', 'routes', 'allow', 'limits', 'oauth', 'jobs'].some(key => key in value) &&
    !Array.isArray(value);
  const tasks: FunctionsDefinition['tasks'] = [];
  const routes: NonNullable<FunctionsDefinition['routes']> = {};
  const oauth: NonNullable<FunctionsDefinition['oauth']> = {};
  const jobs: NonNullable<FunctionsDefinition['jobs']> = {};
  const hosts = new Set<string>();
  const from = new Map<string, string>();
  let limits: { file: string; value: NonNullable<FunctionsDefinition['limits']> } | undefined;
  let found = 0;
  // One name defined once across the files: a task by its id, a route by its path, a connection and a job by name.
  const once = (kind: string, name: string, file: string): void => {
    const before = from.get(`${kind} ${name}`);
    if (before !== undefined) {
      throw new Error(`The ${kind} ${name} is defined twice: in ${before} and in ${file} — one file defines it`);
    }

    from.set(`${kind} ${name}`, file);
  };
  for (const [file, value] of files) {
    if (!isDefinition(value)) {
      continue;
    }

    found += 1;
    for (const task of value.tasks ?? []) {
      once('task', `${task.namespace}.${task.action}`, file);
      tasks.push(task);
    }

    for (const [route, handler] of Object.entries(value.routes ?? {})) {
      once('route', route, file);
      routes[route] = handler;
    }

    for (const [name, connection] of Object.entries(value.oauth ?? {})) {
      once('OAuth connection', name, file);
      oauth[name] = connection;
    }

    for (const [name, job] of Object.entries(value.jobs ?? {})) {
      once('job', name, file);
      jobs[name] = job;
    }

    if (value.limits !== undefined) {
      if (limits !== undefined) {
        throw new Error(
          `The functions' limits are said twice: in ${limits.file} and in ${file} — they are every task's, said once`
        );
      }

      limits = { file, value: value.limits };
    }

    for (const host of value.allow?.hosts ?? []) {
      hosts.add(host);
    }
  }

  if (found === 0) {
    throw new Error(
      "No file at the top of functions/ exports a definition by default: export default defineFunctions({ tasks: [ … ] }) in each domain's file"
    );
  }

  return {
    tasks,
    ...(Object.keys(routes).length > 0 ? { routes } : {}),
    ...(Object.keys(oauth).length > 0 ? { oauth } : {}),
    ...(Object.keys(jobs).length > 0 ? { jobs } : {}),
    ...(limits ? { limits: limits.value } : {}),
    ...(hosts.size > 0 ? { allow: { hosts: [...hosts] } } : {})
  };
};

/** The module a bundle starts from: each definition file imported, their definitions merged (`mergeFunctions`). */
const ENTRY = '\0functions-entry';

const entryModule = (files: string[]): string =>
  [
    ...files.map((file, index) => `import * as file${String(index)} from './${file}';`),
    `const merge = ${mergeFunctions.toString()};`,
    `export default merge([${files.map((file, index) => `[${JSON.stringify(file)}, file${String(index)}.default]`).join(', ')}]);`
  ].join('\n');

/** The most a bundle may weigh: well under the smallest provider a runner may be (Workers take 3 MB compressed). */
export const MAX_FUNCTIONS_BYTES = 1_000_000;

/** The one package a space's code may import: the contract, which is all it needs of the platform. */
const CONTRACT_SPECIFIER = '@plitzi/sdk-server/functions';

/**
 * What that import is inside a bundle: the contract's own `defineFunctions` and `ActionRefusal`, each printed from
 * itself so there is one definition of it — an identity, and the class a refusal is told apart by (its name).
 */
const CONTRACT_MODULE = [
  `export const defineFunctions = ${defineFunctions.toString()};`,
  `export const ActionRefusal = ${ActionRefusal.toString()};`
].join('\n');

const normalize = (file: string): string => path.posix.normalize(file).replace(/^\.\//, '');

/** A file the bundle starts from: one at the top of `functions/` whose text exports its definition by default. */
const isDefinition = (file: string, text: string): boolean => isFunctionsDefinitionFile(file) && exportsByDefault(text);

const sourceProblems = (source: FunctionsSource): FunctionsProblem[] => {
  const problems: FunctionsProblem[] = [];
  for (const file of Object.keys(source)) {
    if (!isFunctionsSourcePath(file)) {
      problems.push({ file, message: 'A file is a relative path under functions/, ending in .ts, .js, .mjs or .json' });
    }
  }

  if (!Object.entries(source).some(([file, text]) => isDefinition(normalize(file), text))) {
    problems.push({
      message:
        'Functions are the files at the top of functions/, each exporting its definition by default: export default defineFunctions({ tasks: [ … ] })'
    });
  }

  return problems;
};

const loaderOf = (file: string): esbuild.Loader => {
  if (file.endsWith('.json')) {
    return 'json';
  }

  return file.endsWith('.ts') ? 'ts' : 'js';
};

/** Where a project keeps its data, seen from its functions: `src/data/` beside `src/functions/`. */
const DATA_FROM_FUNCTIONS = '../data/';

/**
 * Why an import that climbs out of `functions/` is refused, and what to do instead — the space's data is the one thing
 * outside it code reaches for, and it is read at run time (`ctx.data`), as of the run's version, not built in.
 */
const outsideFunctions = (specifier: string, wanted: string): string => {
  const file = wanted.startsWith(DATA_FROM_FUNCTIONS) ? wanted.slice(DATA_FROM_FUNCTIONS.length) : '<file>';

  return `"${specifier}" is outside functions/: functions import only files under functions/ — read the space's data with ctx.data('${file}')`;
};

/** Resolves every import against the space's own files, and the contract; nothing on the disk is ever read. */
const sourcePlugin = (files: Map<string, string>): esbuild.Plugin => ({
  name: 'plitzi-functions-source',
  setup: build => {
    build.onResolve({ filter: /.*/ }, args => {
      if (args.path === CONTRACT_SPECIFIER) {
        return { path: CONTRACT_SPECIFIER, namespace: 'contract' };
      }

      if (args.kind === 'entry-point' && args.path === ENTRY) {
        return { path: ENTRY, namespace: 'entry' };
      }

      if (args.kind !== 'entry-point' && !args.path.startsWith('.')) {
        return {
          errors: [
            {
              text: `"${args.path}" cannot be imported: functions import their own files and ${CONTRACT_SPECIFIER}, nothing else — a package of web APIs is bundled in as one of their files with \`plitzi functions add ${args.path.startsWith('node:') ? '<package>' : args.path}\``
            }
          ]
        };
      }

      const base = args.kind === 'entry-point' ? '.' : path.posix.dirname(args.importer);
      const wanted = normalize(path.posix.join(base, args.path));
      if (wanted === '..' || wanted.startsWith('../')) {
        return { errors: [{ text: outsideFunctions(args.path, wanted) }] };
      }

      const found = [wanted, `${wanted}.ts`, `${wanted}.js`, `${wanted}/index.ts`].find(candidate =>
        files.has(candidate)
      );

      return found
        ? { path: found, namespace: 'functions' }
        : { errors: [{ text: `"${args.path}" is not a file of this space's functions` }] };
    });
    build.onLoad({ filter: /.*/, namespace: 'contract' }, () => ({ contents: CONTRACT_MODULE, loader: 'js' }));
    build.onLoad({ filter: /.*/, namespace: 'entry' }, () => ({
      contents: entryModule(
        [...files]
          .filter(([file, text]) => isDefinition(file, text))
          .map(([file]) => file)
          .sort()
      ),
      loader: 'js',
      resolveDir: '.'
    }));
    build.onLoad({ filter: /.*/, namespace: 'functions' }, args => ({
      contents: files.get(args.path) ?? '',
      loader: loaderOf(args.path),
      resolveDir: '.'
    }));
  }
});

const isMessage = (value: unknown): value is esbuild.Message =>
  typeof value === 'object' && value !== null && 'text' in value && typeof value.text === 'string';

const failureMessages = (error: unknown): esbuild.Message[] =>
  typeof error === 'object' && error !== null && 'errors' in error && Array.isArray(error.errors)
    ? error.errors.filter(isMessage)
    : [];

const problemOf = ({ location, text }: esbuild.Message): FunctionsProblem =>
  location
    ? { file: location.file.replace(/^functions:/, ''), line: location.line, column: location.column, message: text }
    : { message: text };

/**
 * Builds a space's functions into one bundle — the only way code reaches a runner, so what runs is always what the
 * source says. Web-standard and self-contained: the space's own files, and the contract; a Node built-in or any other
 * package is refused with where it was imported, because no runner could provide it.
 */
export const buildFunctions = async (source: FunctionsSource): Promise<FunctionsBuild> => {
  const problems = sourceProblems(source);
  if (problems.length) {
    throw new FunctionsBuildError(problems);
  }

  const files = new Map(Object.entries(source).map(([file, text]) => [normalize(file), text]));
  let result: esbuild.BuildResult<{ write: false }>;
  try {
    result = await esbuild.build({
      entryPoints: [ENTRY],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'neutral',
      target: 'es2022',
      logLevel: 'silent',
      plugins: [sourcePlugin(files)]
    });
  } catch (error) {
    const messages = failureMessages(error);
    throw new FunctionsBuildError(
      messages.length
        ? messages.map(problemOf)
        : [{ message: error instanceof Error ? error.message : 'The build failed' }]
    );
  }

  const code = result.outputFiles[0]?.text ?? '';
  const bytes = Buffer.byteLength(code);
  if (bytes > MAX_FUNCTIONS_BYTES) {
    throw new FunctionsBuildError([
      { message: `Functions are at most ${String(MAX_FUNCTIONS_BYTES)} bytes built, and these are ${String(bytes)}` }
    ]);
  }

  return { code, bytes };
};
