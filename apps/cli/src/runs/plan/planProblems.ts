import { isRecord } from '@plitzi/sdk-shared/helpers';

import { isInventoryItem } from './inventory';
import { isNumber, isSiteAddress, isString, isStrings, oneOf, optional } from '../core/guards';
import { isAcceptance, isPriority, PRIORITIES, QUALITIES } from '../core/model';

const shown = (value: unknown): string => (value === undefined ? 'nothing' : JSON.stringify(value));

/** What keeps `value` from being a plan, field by field — each said with what it should hold. Empty for a plan. */
export const runPlanProblems = (value: unknown): string[] => {
  if (!isRecord(value)) {
    return ['the file holds no object'];
  }

  const problems: string[] = [];
  const field = (ok: boolean, name: string, should: string): void => {
    if (!ok) {
      problems.push(`${name}: ${should}, not ${shown(value[name])}`);
    }
  };
  field(value.version === 1, 'version', '1');
  field(isString(value.runId), 'runId', 'the run’s name');
  field(isString(value.goal), 'goal', 'a line of what the run is for');
  field(optional(value.leftOut, isStrings), 'leftOut', 'lines of what the run does not do');
  field(
    optional(value.reference, isSiteAddress),
    'reference',
    'the address of the site it copies — https://www.example.com'
  );
  field(
    optional(value.inventory, items => Array.isArray(items) && items.every(isInventoryItem)),
    'inventory',
    'pieces, each { id, piece, page?, leftOut? }'
  );
  if (!Array.isArray(value.tasks)) {
    problems.push('tasks: a list of tasks');

    return problems;
  }

  value.tasks.forEach((each: unknown, index) => {
    const at = `tasks[${String(index)}]${isRecord(each) && isString(each.id) ? ` ("${each.id}")` : ''}`;
    if (!isRecord(each)) {
      problems.push(`${at}: an object`);

      return;
    }

    const check = (ok: boolean, name: string, should: string): void => {
      if (!ok) {
        problems.push(`${at}.${name}: ${should}, not ${shown(each[name])}`);
      }
    };
    check(isString(each.id), 'id', 'its name');
    check(isString(each.title), 'title', 'a line');
    check(isStrings(each.files), 'files', 'the paths it writes');
    check(optional(each.dependsOn, isStrings), 'dependsOn', 'the ids it waits for — left out for none');
    check(isPriority(each.priority), 'priority', PRIORITIES.join(', '));
    check(isNumber(each.estimateMinutes), 'estimateMinutes', 'minutes, a number');
    check(
      Array.isArray(each.acceptance) && each.acceptance.every(isAcceptance),
      'acceptance',
      'lines, each a sentence or { said, check, covers? } — a line that covers a piece of the inventory is one a command checks'
    );
    check(optional(each.role, isString), 'role', 'a role’s name');
    check(optional(each.quality, oneOf(QUALITIES)), 'quality', 'light, standard or high');
    check(optional(each.milestone, isString), 'milestone', 'a name');
    check(optional(each.touches, isStrings), 'touches', 'paths');
    check(optional(each.closes, isStrings), 'closes', 'the backlog items it does, by id (b-3)');
    check(
      optional(each.tests, flag => flag === false),
      'tests',
      'false, or left out — a test file is named among a task\'s "files" (it writes its tests itself), or a task of tests says "testsOf"'
    );
    check(
      optional(each.testsOf, isStrings),
      'testsOf',
      'the ids of the tasks whose tests it writes, each in its dependsOn'
    );
    check(optional(each.spike, isString), 'spike', 'what to find out, in words — a research task, no files');
    check(optional(each.findings, isString), 'findings', 'what its spike found for it, in words');
  });

  return problems;
};
