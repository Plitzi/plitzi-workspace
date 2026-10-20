import { authorSpace } from '@plitzi/sdk-authoring';

import { acceptanceText } from './model';
import { shellCommands } from './shell';
import { meantOnPage } from '../commands/check';
import { loadProjectSpace } from '../commands/projectSpace';

import type { PlannedTask } from './model';
import type { SpaceHandles } from '@plitzi/sdk-authoring';

/**
 * What a plan's `page check --expect` names, held to the space as it is (RFC 0028): an id it has no element of is said
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
      const scoped = /^(\/\S*)\s+(.*)$/s.exec(value);
      const rest = scoped?.[2] ?? value;
      const element = rest.slice(0, rest.indexOf('~')).trim();

      return element === '' || element.includes('$') ? [] : [{ element, ...(scoped?.[1] ? { path: scoped[1] } : {}) }];
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

  return wanted
    .filter(expected => !known.has(expected.element))
    .map(
      expected =>
        `Task "${expected.task}": the check of "${expected.said}" expects ${expected.element}${expected.path ? ` on ${expected.path}` : ''}, which the space has no element of now${meantOnPage(expected.element, ids)} — the task makes it, or the check names the one that is there`
    );
};
