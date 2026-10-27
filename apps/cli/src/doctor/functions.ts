import { isRecord } from '@plitzi/sdk-shared/helpers';

import { projectModule } from './projectModules';
import { sayer } from './types';
import { readFunctionsFiles } from '../commands/functions';
import { FUNCTIONS_DIR } from '../scaffold/paths';

import type { Check } from './types';

/**
 * The space's functions (`src/functions/`), built as every runner builds them before running a line — by the
 * `@plitzi/sdk-server` the project installed, so by the rules of the version it runs: an `index.ts` exporting the
 * definition, imports of its own files and the contract alone, and the most a bundle may weigh.
 */

const say = sayer('functions');

type Build = (source: Record<string, string>) => Promise<unknown>;

type Problem = { file?: string; line?: number; message: string };

const isProblem = (value: unknown): value is Problem => isRecord(value) && typeof value.message === 'string';

/** `buildFunctions` of the project's own sdk-server — or nothing, when it has none that offers it. */
const projectBuild = async (root: string): Promise<Build | undefined> => {
  const runner = await projectModule(root, '@plitzi/sdk-server/functions-runner').catch(() => undefined);
  const build = isRecord(runner) ? runner.buildFunctions : undefined;

  // What the module exports is checked to be a function; what it answers is read below as `unknown`, field by field.
  return typeof build === 'function' ? (build as Build) : undefined;
};

/** Where a build problem is, as `functions/<file>:<line>` names it — the folder when it names none. */
const whereOf = (problem: Problem): string =>
  problem.file ? `${FUNCTIONS_DIR}/${problem.file}${problem.line ? `:${String(problem.line)}` : ''}` : FUNCTIONS_DIR;

/**
 * Why the functions of `root` do not build, by the rules of the sdk-server `modulesRoot` installed — each problem with
 * where it is; none when they build, `undefined` when there are none or no build to run them with. What a run's checks
 * hold a task to: a copy importing `node:crypto` passed its tests under `node --test`, and only its server, failing to
 * start, said so.
 */
export const functionsBuildProblems = async (
  root: string,
  modulesRoot: string = root
): Promise<{ where: string; message: string }[] | undefined> => {
  const files = await readFunctionsFiles(root).catch(() => ({}));
  const build = Object.keys(files).length === 0 ? undefined : await projectBuild(modulesRoot);
  if (!build) {
    return undefined;
  }

  try {
    await build(files);

    return [];
  } catch (error) {
    const problems = isRecord(error) && Array.isArray(error.problems) ? error.problems.filter(isProblem) : [];

    return problems.length === 0
      ? [{ where: FUNCTIONS_DIR, message: error instanceof Error ? error.message : String(error) }]
      : problems.map(problem => ({ where: whereOf(problem), message: problem.message }));
  }
};

export const checkFunctions: Check = async ({ root, answers }) => {
  const files = await readFunctionsFiles(root).catch(() => ({}));
  if (Object.keys(files).length === 0) {
    return [];
  }

  if (answers.mode !== 'server') {
    return [
      say.warning(
        'functions-without-server',
        `${FUNCTIONS_DIR}/ holds code, and this project has no server to run it.`,
        {
          file: FUNCTIONS_DIR,
          fix: 'plitzi space push functions sends them to the space on Plitzi, which runs them.'
        }
      )
    ];
  }

  const problems = await functionsBuildProblems(root);
  if (problems === undefined) {
    return [
      say.warning(
        'functions-not-checked',
        `${FUNCTIONS_DIR}/ was not built: the project's @plitzi/sdk-server does not offer the build (an older one, or none installed).`,
        { file: FUNCTIONS_DIR, fix: 'plitzi upgrade packages --write' }
      )
    ];
  }

  return problems.map(problem => say.error('functions-do-not-build', problem.message, { file: problem.where }));
};
