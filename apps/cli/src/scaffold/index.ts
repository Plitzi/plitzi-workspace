import { clientFiles } from './client';
import { cliReadme } from './cliReadme';
import { MACHINERY } from './machinery';
import { ACTIONS_ENTRY, CLI_DIR, MAIN_FILE, SERVER_OPTIONS_FILE } from './paths';
import { pluginFiles } from './plugin';
import { projectFiles } from './project';
import { qualityFiles } from './quality';
import { serverFiles } from './server';
import { skillFiles } from './skills';
import { spaceFiles } from './space';
import { visualFiles } from './visual';

import type { CreateAnswers, ProjectFiles } from './types';

export { SDK_VERSION } from './project';

export {
  PACKAGE_MANAGERS,
  detectManagerVersion,
  detectPackageManager,
  installCommand,
  runCommand
} from './packageManager';

export {
  declarationsRegistry,
  elementsRegistry,
  pluginFunctionsFile,
  pluginNameProblem,
  pluginNames,
  scaffoldElement,
  scaffoldPlugin,
  shapeFromFlags
} from './pluginPackage';

export type { ElementShape, PluginNames, ShapeFlags } from './pluginPackage';
export { CREATE_TEMPLATES } from './types';

export type { CreateAnswers, CreateTemplate, PackageManager, PluginAnswers, ProjectFiles } from './types';

/**
 * Every file of a generated project, assembled from the two decisions that shape it.
 *
 * Pure, and separate from the command that writes them, so what the scaffold SAYS can be asserted without a
 * filesystem — and because the interesting part of this feature is the contents. A scaffold that produces a
 * project nobody can read is one its owner replaces rather than learns from, so each file carries the reasoning
 * that would otherwise live in documentation they have not opened.
 */
export const scaffold = (answers: CreateAnswers): ProjectFiles => ({
  ...projectFiles(answers),
  ...qualityFiles(answers),
  ...spaceFiles(answers),
  ...pluginFiles(answers),
  ...(answers.mode === 'server' ? serverFiles(answers) : clientFiles(answers)),
  ...visualFiles(answers),
  ...skillFiles(),
  [`${CLI_DIR}/README.md`]: cliReadme(answers)
});

export const machineryFiles = (answers: CreateAnswers): ProjectFiles =>
  Object.fromEntries(Object.entries(scaffold(answers)).filter(([file]) => MACHINERY.has(file)));

/**
 * The project's own files the machinery imports, by the machinery file that reads them: written by `create`, the
 * project's from then on. `plitzi upgrade` writes one into a project that has none only when the file reading it is
 * the CLI's — written by this upgrade or already current: beside a `main.ts` the project made its own, nothing reads it.
 */
const SEEDS: Readonly<Record<string, string>> = {
  [SERVER_OPTIONS_FILE]: MAIN_FILE,
  [ACTIONS_ENTRY]: MAIN_FILE
};

export const seedFiles = (answers: CreateAnswers): { file: string; contents: string; readBy: string }[] =>
  Object.entries(scaffold(answers)).flatMap(([file, contents]) =>
    Object.hasOwn(SEEDS, file) ? [{ file, contents, readBy: SEEDS[file] }] : []
  );
