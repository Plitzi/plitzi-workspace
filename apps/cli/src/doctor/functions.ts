import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

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
          fix: 'plitzi functions push sends them to the space on Plitzi, which runs them.'
        }
      )
    ];
  }

  const build = await projectBuild(root);
  if (!build) {
    return [
      say.warning(
        'functions-not-checked',
        `${FUNCTIONS_DIR}/ was not built: the project's @plitzi/sdk-server does not offer the build (an older one, or none installed).`,
        { file: FUNCTIONS_DIR, fix: 'plitzi upgrade packages --write' }
      )
    ];
  }

  try {
    await build(files);

    return [];
  } catch (error) {
    const problems = isRecord(error) && Array.isArray(error.problems) ? error.problems.filter(isProblem) : [];
    if (problems.length === 0) {
      return [
        say.error('functions-do-not-build', error instanceof Error ? error.message : String(error), {
          file: FUNCTIONS_DIR
        })
      ];
    }

    return problems.map(problem =>
      say.error('functions-do-not-build', problem.message, {
        file: problem.file
          ? `${FUNCTIONS_DIR}/${problem.file}${problem.line ? `:${String(problem.line)}` : ''}`
          : FUNCTIONS_DIR
      })
    );
  }
};
