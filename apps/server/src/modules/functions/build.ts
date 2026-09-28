import path from 'node:path';

import esbuild from 'esbuild';

import { isFunctionsSourcePath } from '@plitzi/sdk-shared/actions';

import { ActionRefusal, defineFunctions } from './contract';

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

/** The file a space's functions start from. */
export const FUNCTIONS_ENTRY = 'index.ts';

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

const sourceProblems = (source: FunctionsSource): FunctionsProblem[] => {
  const problems: FunctionsProblem[] = [];
  for (const file of Object.keys(source)) {
    if (!isFunctionsSourcePath(file)) {
      problems.push({ file, message: 'A file is a relative path under functions/, ending in .ts, .js, .mjs or .json' });
    }
  }

  if (!(FUNCTIONS_ENTRY in source)) {
    problems.push({ message: `Functions start from ${FUNCTIONS_ENTRY}, which exports the definition by default` });
  }

  return problems;
};

const loaderOf = (file: string): esbuild.Loader => {
  if (file.endsWith('.json')) {
    return 'json';
  }

  return file.endsWith('.ts') ? 'ts' : 'js';
};

/** Resolves every import against the space's own files, and the contract; nothing on the disk is ever read. */
const sourcePlugin = (files: Map<string, string>): esbuild.Plugin => ({
  name: 'plitzi-functions-source',
  setup: build => {
    build.onResolve({ filter: /.*/ }, args => {
      if (args.path === CONTRACT_SPECIFIER) {
        return { path: CONTRACT_SPECIFIER, namespace: 'contract' };
      }

      if (args.kind !== 'entry-point' && !args.path.startsWith('.')) {
        return {
          errors: [
            {
              text: `"${args.path}" cannot be imported: functions import their own files and ${CONTRACT_SPECIFIER}, nothing else`
            }
          ]
        };
      }

      const base = args.kind === 'entry-point' ? '.' : path.posix.dirname(args.importer);
      const wanted = normalize(path.posix.join(base, args.path));
      const found = [wanted, `${wanted}.ts`, `${wanted}.js`, `${wanted}/index.ts`].find(candidate =>
        files.has(candidate)
      );

      return found
        ? { path: found, namespace: 'functions' }
        : { errors: [{ text: `"${args.path}" is not a file of this space's functions` }] };
    });
    build.onLoad({ filter: /.*/, namespace: 'contract' }, () => ({ contents: CONTRACT_MODULE, loader: 'js' }));
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
      entryPoints: [FUNCTIONS_ENTRY],
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
