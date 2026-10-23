import { namesServedCopy } from './acceptance';
import { acceptanceText } from './model';
import { shellCommands } from './shell';
import { scriptsOf } from '../commands/verify';

import type { RunPlan } from './model';

/** What would make a task's acceptance unworkable, said by `run plan` and `run amend` before any agent meets it. */

/**
 * The words a `plitzi page check` (or `page shot`) in `check` reads as pages that are no path — `week` out of
 * `--expect digest-title~This week`, the shell having split an unquoted text: the page asked for is never there.
 */
const strayPages = (check: string): string[] =>
  shellCommands(check).flatMap(words => {
    const at = words.findIndex(
      (word, index) => word === 'page' && (words[index + 1] === 'check' || words[index + 1] === 'shot')
    );
    if (at === -1 || !words.slice(0, at).some(word => word === 'plitzi' || word.endsWith('/plitzi'))) {
      return [];
    }

    const stray: string[] = [];
    const rest = words.slice(at + 2);
    for (let index = 0; index < rest.length; index += 1) {
      const word = rest[index] ?? '';
      // A redirection is the shell's, never a page: `2>&1`, `>out.txt` — and `> out.txt`, its target the next word.
      if (/^(\d*|&)(>>?|<)/.test(word)) {
        if (/^(\d*|&)(>>?|<)$/.test(word)) {
          index += 1;
        }

        continue;
      }

      if (word.startsWith('-')) {
        // A flag's value follows it, unless written `--flag=value` or another flag comes next.
        if (!word.includes('=') && !(rest[index + 1] ?? '-').startsWith('-')) {
          index += 1;
        }
      } else if (!word.startsWith('/') && !word.includes('$')) {
        stray.push(word);
      }
    }

    return stray;
  });

/**
 * What would make a task's acceptance unworkable, said before the run opens rather than at its `complete`: a line that
 * says nothing, a check that is no command, one that reads the credentials no agent touches, or one that asks for the
 * copy served (`$PLITZI_URL`) in a project with no start script to serve it.
 */
export const acceptanceProblems = async (root: string, task: RunPlan['tasks'][number]): Promise<string[]> => {
  const problems: string[] = [];
  for (const each of task.acceptance) {
    const said = acceptanceText(each).trim();
    if (said === '') {
      problems.push(`Task "${task.id}": a line of its acceptance says nothing — say what is asked`);
      continue;
    }

    if (typeof each === 'string') {
      continue;
    }

    const check = each.check.trim();
    if (check === '') {
      problems.push(`Task "${task.id}": "${said}" has an empty check — give the command, or leave the line as text`);
    } else if (/(^|[\s'"/=<])\.env(\.[\w.-]+)?($|[\s'";|&>)])/.test(check) && !check.includes('.env.example')) {
      problems.push(`Task "${task.id}": the check of "${said}" reads .env, the credentials no agent touches`);
    } else if (strayPages(check).length > 0) {
      const stray = strayPages(check);
      problems.push(
        `Task "${task.id}": the check of "${said}" hands page check ${stray.map(word => `"${word}"`).join(', ')} as a page — a text with a space split by the shell: quote it (--expect "id~Two words")`
      );
    } else if (namesServedCopy(check)) {
      const scripts = await scriptsOf(root).catch(() => ({}));
      if (!['start', 'start:dev'].some(name => Object.hasOwn(scripts, name))) {
        problems.push(
          `Task "${task.id}": the check of "${said}" names the copy served ($PLITZI_URL, $PLITZI_PORT), and the project has no start script to serve it with`
        );
      }
    }
  }

  return problems;
};
