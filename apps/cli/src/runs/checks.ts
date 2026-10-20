import { runScript, scriptsOf, stepsOf, tail } from '../commands/verify';

/**
 * The project's checks over a copy of it — a task's, or the run's whole before the final merge: what `plitzi verify`
 * runs (author with no warning, the space's lint, types, lint, tests, format), each the project's own script, in the
 * copy, with the project's installed binaries. The pages are not among them: they need the server, and are looked at
 * by whoever reviews.
 */

export interface CheckStep {
  name: string;
  ok: boolean;
  said?: string[];
}

export interface CheckResult {
  ok: boolean;
  steps: CheckStep[];
  /** Said when the project has none of the scripts: nothing was checked, and that is not a pass to keep quiet. */
  none?: string;
}

/** How a run checks a folder: the project's scripts by default, something else under test. */
export type CheckRunner = (dir: string, projectRoot: string) => Promise<CheckResult>;

export const projectChecks: CheckRunner = async (dir, projectRoot) => {
  const steps = stepsOf(await scriptsOf(dir));
  if (steps.length === 0) {
    return { ok: true, steps: [], none: 'the project has no author, lint, typecheck, test or format script to run' };
  }

  const results: CheckStep[] = [];
  for (const step of steps) {
    const { code, output } = await runScript(dir, step.command, projectRoot);
    const ok = code === 0 && !step.failsOn?.test(output);
    results.push({ name: step.name, ok, ...(ok ? {} : { said: tail(output) }) });
    if (!ok) {
      break;
    }
  }

  return { ok: results.every(result => result.ok), steps: results };
};
