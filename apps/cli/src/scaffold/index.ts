import { clientFiles } from './client';
import { pluginFiles } from './plugin';
import { projectFiles } from './project';
import { qualityFiles } from './quality';
import { serverFiles } from './server';
import { skillFiles } from './skills';
import { spaceFiles } from './space';
import { visualFiles } from './visual';

import type { CreateAnswers, ProjectFiles } from './types';

export { PACKAGE_MANAGERS, detectPackageManager, installCommand, runCommand } from './packageManager';

export type { CreateAnswers, PackageManager, ProjectFiles } from './types';

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
