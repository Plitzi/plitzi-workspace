import { clientFiles } from './client';
import { pluginFiles } from './plugin';
import { projectFiles } from './project';
import { qualityFiles } from './quality';
import { serverFiles } from './server';
import { skillFiles } from './skills';
import { spaceFiles } from './space';
import { visualFiles } from './visual';

import type { CreateAnswers, ProjectFiles } from './types';

export { projectDeclarations } from './plugin';

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
  ...skillFiles()
});

/**
 * The files of a project that are this CLI's machinery rather than the project's own: what `plitzi upgrade` keeps up
 * with the CLI. Named, not inferred, so a file the scaffold starts a project with — its space, pages, plugins, data,
 * README, `.env` — can never be taken for one: those are the project's from the moment they are written.
 *
 * `package.json` is not among them: it is merged, never replaced (`upgrade packages`). Nor are the skills, which come
 * from the packages installed (`upgrade skills`).
 */
const MACHINERY = new Set([
  'src/author.ts',
  'src/main.ts',
  'src/preflight.css',
  'index.html',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.build.json',
  '.gitignore',
  'AGENTS.md',
  'CLAUDE.md',
  '.prettierrc',
  '.prettierignore',
  'eslint.config.mjs',
  'playwright.config.ts',
  'visual/home.spec.ts',
  'src/plugins/README.md',
  '.yarnrc.yml',
  'pnpm-workspace.yaml'
]);

export const machineryFiles = (answers: CreateAnswers): ProjectFiles =>
  Object.fromEntries(Object.entries(scaffold(answers)).filter(([file]) => MACHINERY.has(file)));
