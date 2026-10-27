import { REFUSAL_EXIT_CODES } from './runs/core/refusal';

/**
 * Why a command cannot run from where it was started — the folder the shell is in was removed (a task's copy, once its
 * task is approved), which what the CLI loads first reads: a run's tester got Node's stack and its version banner for
 * a `run notice` said there — or nothing when it can. Kept free of imports that read the folder: `bin` asks it first.
 */
export const removedFolder = (cwd: () => string = () => process.cwd()): { text: string; code: number } | undefined => {
  try {
    cwd();

    return undefined;
  } catch {
    return {
      text: 'Refused (invalid): the folder this shell is in was removed — a task’s copy goes once its task is approved. Go to the project (cd to its folder) and run the command there.',
      code: REFUSAL_EXIT_CODES.invalid
    };
  }
};
