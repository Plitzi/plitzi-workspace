import { createSystem, createVirtualTypeScriptEnvironment } from '@typescript/vfs';
import ts from 'typescript';

import functionsApi from '@plitzi/sdk-server/functions-api.d.ts?raw';

import type { VirtualTypeScriptEnvironment } from '@typescript/vfs';

/** The language, and the globals of a worker: the web APIs every runner a space's code may land on has. */
const libs = import.meta.glob<string>(
  '@typescript-lib/lib.{es5,es2015,es2015.*,es2016,es2016.*,es2017,es2017.*,es2018,es2018.*,es2019,es2019.*,es2020,es2020.*,es2021,es2021.*,es2022,es2022.*,decorators,decorators.legacy,webworker,webworker.*}.d.ts',
  { query: '?raw', import: 'default', eager: true }
);

const CONTRACT_PATH = '/types/functions-api.d.ts';

const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ['lib.es2022.d.ts', 'lib.webworker.d.ts'],
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  types: [],
  paths: { '@plitzi/sdk-server/functions': [CONTRACT_PATH] }
};

/**
 * The TypeScript a space's functions are checked with: the libs, the contract at `@plitzi/sdk-server/functions`, and
 * nothing else — the space's own files are added as the editor opens and changes them.
 */
export const createFunctionsEnvironment = (): VirtualTypeScriptEnvironment => {
  const files = new Map<string, string>([[CONTRACT_PATH, functionsApi]]);
  Object.entries(libs).forEach(([file, text]) => files.set(`/${file.slice(file.lastIndexOf('/') + 1)}`, text));

  return createVirtualTypeScriptEnvironment(createSystem(files), [], ts, compilerOptions);
};
