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
    // A task leaves the space as the project wants it: no warnings, and no suggestions either — a suggestion is the long
    // way to a page that has a short one, and a run's tasks are where it is written the short way (or said why not).
    const suggestions = step.name === 'author' ? output.split('\n').filter(line => line.startsWith('[suggest] ')) : [];
    const ok = code === 0 && !step.failsOn?.test(output) && suggestions.length === 0;
    results.push({
      name: step.name,
      ok,
      ...(ok
        ? {}
        : {
            said:
              code === 0 && suggestions.length > 0
                ? [
                    ...suggestions,
                    'A task completes with none: write them the short way (npx plitzi space fix shows how), or say why not (--known-failure)'
                  ]
                : tail(output)
          })
    });
    if (!ok) {
      break;
    }
  }

  return { ok: results.every(result => result.ok), steps: results };
};

// A line that says how long something took changes from one run to the next: it is not what failed.
const DURATION = /\b\d+(?:\.\d+)?\s?(?:ms|s|m)\b/;

const linesOf = (step: CheckStep, dirs: readonly (string | RegExp)[]): Set<string> =>
  new Set(
    (step.said ?? [])
      .map(line => dirs.reduce<string>((text, dir) => text.split(dir).join(''), line).trim())
      .filter(line => line !== '' && !DURATION.test(line))
  );

/**
 * Whether every check that fails in `mine` fails the same way in `without` — the same folder without the change: the
 * same step failing, saying nothing `without` does not say. A change that adds a failure of its own is never excused.
 * `dirs` are what each folder's paths start with, so the two are compared by what they say, not where they ran.
 */
export const failsWithout = (mine: CheckResult, without: CheckResult, dirs: readonly (string | RegExp)[]): boolean => {
  const failing = mine.steps.filter(step => !step.ok);
  if (failing.length === 0) {
    return false;
  }

  return failing.every(step => {
    const before = without.steps.find(each => each.name === step.name && !each.ok);
    if (!before) {
      return false;
    }

    const known = linesOf(before, dirs);

    return [...linesOf(step, dirs)].every(line => known.has(line));
  });
};
