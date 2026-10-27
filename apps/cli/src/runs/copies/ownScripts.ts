import path from 'node:path';

import { shellCommands } from '../core/shell';

import type { RunPlan } from '../core/model';

/**
 * The scripts of a lead's own an acceptance line runs — `node checks/moves.mjs`, `python3 probe.py` — where a Plitzi
 * command would say the same to any agent and be rerun by it: what Plitzi could not check yet, or what the lead did
 * not know it could. Said at `run open --dry-run` and counted in the run's feedback, so each round names the gaps it worked
 * around (the lead's two scripts checked a carousel and the article pages, unseen by the run).
 */

/** What runs a file of one's own: an interpreter given a path, or the path itself. */
const INTERPRETERS = new Set(['node', 'python', 'python3', 'bash', 'sh', 'zsh', 'deno', 'bun', 'ruby', 'perl', 'php']);

const SCRIPT_FILE = /\.(m?js|cjs|ts|py|sh|rb|pl|php)$/;

/** A test of the project's, named as one. */
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]s$/;

/** Each script a check runs, said by its interpreter and its file's name — never its whole path. */
export const ownScriptsIn = (check: string): string[] =>
  shellCommands(check).flatMap(words => {
    const first = words.at(0);
    const rest = words.slice(1);
    if (first === undefined) {
      return [];
    }

    if (INTERPRETERS.has(path.basename(first))) {
      // The project's own tests (`node --test src/x.test.ts`) are the project's, any agent reruns them: no script of one's.
      if (rest.includes('--test')) {
        return [];
      }

      const file = rest.find(word => !word.startsWith('-'));

      return file !== undefined && SCRIPT_FILE.test(file) && !TEST_FILE.test(file)
        ? [`${path.basename(first)} ${path.basename(file)}`]
        : [];
    }

    return SCRIPT_FILE.test(first) && (first.startsWith('./') || first.startsWith('/')) ? [path.basename(first)] : [];
  });

/** The plan's acceptance lines a script of one's own checks: each task's, with what it runs. */
export const ownScriptLines = (
  tasks: readonly RunPlan['tasks'][number][]
): { task: string; line: string; scripts: string[] }[] =>
  tasks.flatMap(task =>
    task.acceptance.flatMap(each => {
      if (typeof each === 'string') {
        return [];
      }

      const scripts = ownScriptsIn(each.check);

      return scripts.length > 0 ? [{ task: task.id, line: each.said, scripts }] : [];
    })
  );

/** What `run open --dry-run` says of them: the Plitzi commands a check is best written with, and how to say what none can. */
export const ownScriptNotices = (tasks: RunPlan['tasks']): string[] =>
  ownScriptLines(tasks).map(
    ({ task, line, scripts }) =>
      `Task "${task}": "${line}" runs a script of yours (${scripts.join(', ')}) — written with Plitzi (page play, page measure --same, page check --expect) any agent reads and reruns it; what Plitzi cannot check yet, say: plitzi run notice --plitzi "…", and the run's feedback counts it`
  );
