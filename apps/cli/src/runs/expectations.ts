import { authorSpace } from '@plitzi/sdk-authoring';

import { acceptanceText } from './model';
import { shellCommands } from './shell';
import { isNotFoundPage, meantOnPage, pageFor } from '../commands/check';
import { loadProjectSpace } from '../commands/projectSpace';
import { readExpectation } from '../options';

import type { PlannedTask } from './model';
import type { SpaceHandles } from '@plitzi/sdk-authoring';

/**
 * What a plan's `page check --expect` names, held to the space as it is: an id it has no element of is said
 * at `run plan` — the task may make it, so it is a notice, not a refusal — with the id it more likely meant: a page
 * family's (`pet-luna-age-label` for `age-label`), or the nearest. A check that expects what is not there costs an
 * agent a round, and the lead the blocked task that asks why.
 */

interface Expected {
  element: string;
  path?: string;
}

/** The elements a check's `page check` commands expect, by id, as `--expect` takes them. */
export const expectedIds = (check: string): Expected[] =>
  shellCommands(check).flatMap(words => {
    const at = words.findIndex((word, index) => word === 'page' && words[index + 1] === 'check');
    if (at === -1) {
      return [];
    }

    const values = words.slice(at + 2).flatMap((word, index, rest) => {
      if (word.startsWith('--expect=')) {
        return [word.slice('--expect='.length)];
      }

      const value = rest.at(index + 1);

      return word === '--expect' && value !== undefined ? [value] : [];
    });

    return values.flatMap(value => {
      const read = readExpectation(value);

      return !read || read.element.includes('$')
        ? []
        : [{ element: read.element, ...(read.path ? { path: read.path } : {}) }];
    });
  });

/** The project's space as it is, authored: its pages and elements — none when it does not author, which its checks say. */
export const authoredHandles = async (root: string): Promise<SpaceHandles | undefined> => {
  const project = await loadProjectSpace(root);
  if ('problem' in project) {
    return undefined;
  }

  try {
    return authorSpace(project.space, project.authoring).handles;
  } catch {
    return undefined;
  }
};

/** Each expected id of the plan's checks the space has no element of now, said with what it more likely meant. */
export const expectationNotices = async (root: string, tasks: readonly PlannedTask[]): Promise<string[]> => {
  const wanted = tasks.flatMap(task =>
    task.acceptance.flatMap(each =>
      typeof each === 'string'
        ? []
        : expectedIds(each.check).map(expected => ({ task: task.id, said: acceptanceText(each), ...expected }))
    )
  );
  if (wanted.length === 0) {
    return [];
  }

  // A project that does not author is said by the checks it runs: here there is nothing to hold the ids to.
  const handles = await authoredHandles(root);
  if (!handles) {
    return [];
  }

  const ids = Object.keys(handles.elements);

  const known = new Set(ids);

  // Once an element a check: one that expects four texts of it is one element the space lacks, not four (la-velada).
  const said = new Set<string>();

  const missing = wanted
    .filter(expected => !known.has(expected.element))
    .filter(expected => {
      const key = JSON.stringify([expected.task, expected.said, expected.element, expected.path]);
      const first = !said.has(key);
      said.add(key);

      return first;
    });
  // One line a task, its elements together: a stage whose tasks make every element its checks read said each apart —
  // 37 lines in lx-copy's scope, burying the one warning that mattered.
  const byTask = new Map<string, typeof missing>();
  missing.forEach(expected => byTask.set(expected.task, [...(byTask.get(expected.task) ?? []), expected]));

  return [...byTask].map(([task, each]) =>
    each.length === 1
      ? `Task "${task}": the check of "${each[0].said}" expects ${each[0].element}${each[0].path ? ` on ${each[0].path}` : ''}, which the space has no element of now${meantOnPage(each[0].element, ids)} — the task makes it, or the check names the one that is there`
      : `Task "${task}": its checks expect ${[...new Set(each.map(expected => expected.element))].join(', ')}, which the space has none of now — the task makes them, or a check names the one that is there`
  );
};

/** The addresses a check's `page check` commands ask — those before any flag — and whether they say a status. */
export const checkedPaths = (check: string): { paths: string[]; status: boolean }[] =>
  shellCommands(check).flatMap(words => {
    const at = words.findIndex((word, index) => word === 'page' && words[index + 1] === 'check');
    if (at === -1) {
      return [];
    }

    const rest = words.slice(at + 2);
    const flag = rest.findIndex(word => word.startsWith('-'));

    return [
      {
        paths: (flag === -1 ? rest : rest.slice(0, flag)).filter(word => word.startsWith('/')),
        status: rest.some(word => word === '--status' || word.startsWith('--status='))
      }
    ];
  });

/** Whether no page of the space answers `path` but its not-found page: sent with 404. */
export const fallsToNotFound = (handles: SpaceHandles, path: string): boolean => {
  const page = pageFor(handles, path);

  return page === undefined || (Object.hasOwn(handles.pages, page) && isNotFoundPage(handles.pages[page]));
};

/**
 * The tasks after `task` — waiting on it, however far — that check `path` too: one of them likely makes the page, and
 * `task`'s check on it cannot pass before that one (lx-copy: t-card measured its card on the collection page that
 * t-collection made, and t-collection waited for t-card).
 */
export const checkedAfter = (
  tasks: readonly Pick<PlannedTask, 'id' | 'dependsOn'>[],
  asked: readonly { task: string; path: string }[],
  task: string,
  path: string
): string[] => {
  const after = new Set<string>();
  for (let grew = true; grew;) {
    grew = false;
    for (const each of tasks) {
      if (!after.has(each.id) && each.dependsOn.some(dep => dep === task || after.has(dep))) {
        after.add(each.id);
        grew = true;
      }
    }
  }

  return [...after].filter(other => asked.some(each => each.task === other && each.path === path));
};

/**
 * Each check of the plan that asks an address no page of the space answers — it falls to the not-found page, sent with
 * 404 — and says no `--status`: it fails on the status, whatever the page shows (velada-polish's lead wrote one, and
 * dev-3 asked why the acceptance could not pass). A notice: the task may make the page.
 */
export const notFoundNotices = async (root: string, tasks: readonly PlannedTask[]): Promise<string[]> => {
  const asked = tasks.flatMap(task =>
    task.acceptance.flatMap(each =>
      typeof each === 'string'
        ? []
        : checkedPaths(each.check)
            .filter(command => !command.status)
            .flatMap(command => command.paths.filter(path => !/[${]/.test(path)))
            .map(path => ({ task: task.id, said: acceptanceText(each), path }))
    )
  );
  if (asked.length === 0) {
    return [];
  }

  const handles = await authoredHandles(root);
  if (!handles) {
    return [];
  }

  return asked
    .filter(({ path }) => fallsToNotFound(handles, path))
    .map(({ task, said, path }) => {
      const later = checkedAfter(tasks, asked, task, path);

      return later.length > 0
        ? `Task "${task}": the check of "${said}" asks ${path}, which no page answers yet, and ${later.join(', ')} — after it — ${later.length === 1 ? 'checks' : 'check'} it too: if ${later.length === 1 ? 'that task makes' : 'one of them makes'} it, this check cannot pass before ${later.length === 1 ? 'it' : 'them'}, a deadlock — move the line there`
        : `Task "${task}": the check of "${said}" asks ${path}, which no page of the space answers — it falls to the not-found page, sent with 404: say --status 404, or the check fails on the status (unless the task makes that page)`;
    });
};
