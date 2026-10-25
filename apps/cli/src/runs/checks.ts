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
  /** What a step that passed still warns of — the space's lint: each `file:line code`, said where it is seen. */
  warnings?: string[];
}

export interface CheckResult {
  ok: boolean;
  steps: CheckStep[];
  /** Said when the project has none of the scripts: nothing was checked, and that is not a pass to keep quiet. */
  none?: string;
  /** Not run again: the same tree passed them at this time (`checkVersions`). */
  reused?: string;
}

/** How a run checks a folder: the project's scripts by default, something else under test. */
/**
 * `final`: the run's whole result, at its finish — held to everything. Otherwise a task's copy, or the run's work part
 * way: what one task declares for the tasks after it (a component, a token) is read by none yet, and said, not failed.
 */
export interface CheckOptions {
  final?: boolean;
}

export type CheckRunner = (dir: string, projectRoot: string, options?: CheckOptions) => Promise<CheckResult>;

/** A suggestion that something is declared and read by nothing yet — a component, a token, a class: `unused-component`. */
const UNUSED = /^\[suggest\] unused-/;

/**
 * The warnings in what `plitzi space lint` printed, a line each: `src/space/pages/home.ts:1 file-too-long`. Read off
 * its text, the project's script being what runs: a file's name heads its findings, each `line:column severity
 * message code`.
 */
export const lintWarnings = (output: string): string[] => {
  const found: string[] = [];
  let heading = 'the space';
  for (const line of output.split('\n')) {
    const finding = /^\s+(\d+:\d+|-)\s+warning\s.*\s([a-z][a-z0-9-]+)\s*$/.exec(line);
    if (finding) {
      const [, at = '-', code = ''] = finding;
      found.push(`${heading}${at === '-' ? '' : `:${at.split(':')[0] ?? ''}`} ${code}`);
    } else if (/^\S/.test(line) && !/^(plitzi |What each|Not checked|Passes|Fails|Clean)/.test(line)) {
      // A file's name heads its findings; the space's own findings come under "the space (no one line wrote it)".
      heading = line.startsWith('the space') ? 'the space' : line.trim();
    }
  }

  return found;
};

/** How many of the project's steps run at once after `author`: several agents complete at once on one machine. */
const AT_ONCE = 3;

export const projectChecks: CheckRunner = async (dir, projectRoot, { final = false } = {}) => {
  const steps = stepsOf(await scriptsOf(dir));
  if (steps.length === 0) {
    return { ok: true, steps: [], none: 'the project has no author, lint, typecheck, test or format script to run' };
  }

  // Whether the space authored, whatever author suggested: what the steps after it read is there.
  const space = { authors: false };
  const run = async (step: (typeof steps)[number]): Promise<CheckStep> => {
    const { code, output } = await runScript(dir, step.command, projectRoot);
    if (step.name === 'author') {
      space.authors = code === 0;
    }

    // A task leaves the space as the project wants it: no warnings, and no suggestions either — a suggestion is the long
    // way to a page that has a short one, and a run's tasks are where it is written the short way (or said why not).
    const said = step.name === 'author' ? output.split('\n').filter(line => line.startsWith('[suggest] ')) : [];
    // Declared for a task after it, read by none yet: the lead sees it at review, the finish holds the whole to it.
    const pending = final ? [] : said.filter(line => UNUSED.test(line));
    const suggestions = said.filter(line => !pending.includes(line));
    const ok = code === 0 && !step.failsOn?.test(output) && suggestions.length === 0;
    const warnings = ok
      ? [
          ...(step.name === 'lint:space' ? lintWarnings(output) : []),
          ...pending.map(line => `${line.slice('[suggest] '.length)} — read by no task yet; the finish needs it read`)
        ]
      : [];

    return {
      name: step.name,
      ok,
      ...(warnings.length > 0 ? { warnings } : {}),
      ...(ok
        ? {}
        : {
            said:
              code === 0 && suggestions.length > 0
                ? [
                    ...suggestions,
                    'A task completes with none: write them the short way (npx plitzi space fix shows how), or say why not (plitzi task complete --known-failure "why")'
                  ]
                : tail(output)
          })
    };
  };

  // The space is authored first — a space that does not author fails every step after it the same way. Past it, the
  // steps read the source and none writes what another reads: they run at once, and each says what it found.
  const first = steps[0].name === 'author' ? steps[0] : undefined;
  const rest = first ? steps.slice(1) : steps;
  const results: CheckStep[] = [];
  if (first) {
    const authored = await run(first);
    results.push(authored);
    // A space that does not author stops here; one that authors with suggestions to write the short way does not —
    // the steps after it still say what they find, or a failing typecheck goes to review unseen behind them.
    if (!authored.ok && !space.authors) {
      return { ok: false, steps: results };
    }
  }

  const later: CheckStep[] = new Array<CheckStep>(rest.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(AT_ONCE, rest.length) }, async () => {
      while (next < rest.length) {
        const index = next;
        next += 1;
        later[index] = await run(rest[index]);
      }
    })
  );
  results.push(...later);

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
export const failsWithout = (mine: CheckResult, without: CheckResult, dirs: readonly (string | RegExp)[]): boolean =>
  mine.steps.some(step => !step.ok) && ownFailing(mine, without, dirs).length === 0;

/**
 * The steps that fail in `mine` and not, or not this way, in `without`: what the copy's own work fails — never what it
 * only shares with the run's work.
 */
export const ownFailing = (mine: CheckResult, without: CheckResult, dirs: readonly (string | RegExp)[]): CheckStep[] =>
  mine.steps.filter(step => {
    if (step.ok) {
      return false;
    }

    const before = without.steps.find(each => each.name === step.name && !each.ok);
    if (!before) {
      return true;
    }

    const known = linesOf(before, dirs);

    return ![...linesOf(step, dirs)].every(line => known.has(line));
  });
