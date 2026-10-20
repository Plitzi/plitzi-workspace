import { isRecord } from '@plitzi/sdk-shared/helpers';

import { ID } from './paths';

import type { Acceptance, PlannedTask, RunPlan } from './model';

/**
 * What the job asks, piece by piece — a page, a section, a tool a visitor would miss — listed before the plan, so what
 * a run covers is checked against it rather than remembered: each piece is proven by a task's acceptance that a command
 * checks (`covers`), or left out with its reason. la-velada's first run left the tier list, the live stream and a
 * dozen pieces unsaid: they were in no list to be missed from.
 */
export interface InventoryItem {
  id: string;
  /** What it is, as a visitor would name it: "the tier list builder", "the fight's stats". */
  piece: string;
  /** Where it is: a page's path. */
  page?: string;
  /** Not in this run, and why: said to the person at `run plan` and `run open`, and in the report. */
  leftOut?: string;
}

export const isInventoryItem = (value: unknown): value is InventoryItem =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.piece === 'string' &&
  (value.page === undefined || typeof value.page === 'string') &&
  (value.leftOut === undefined || typeof value.leftOut === 'string');

/** The inventory ids a line of acceptance proves — only a line a command checks proves one. */
export const coversOf = (each: Acceptance): string[] => (typeof each === 'string' ? [] : (each.covers ?? []));

/**
 * What keeps the inventory from being whole: an id twice, a piece no checked acceptance covers and the plan does not
 * leave out, one both covered and left out, a line covering a piece the inventory does not list. `known` are the
 * pieces of the run a stage is stacked on: its lines may cover them.
 */
export const inventoryProblems = (
  plan: Pick<RunPlan, 'inventory' | 'tasks'>,
  known: ReadonlySet<string> = new Set()
): string[] => {
  const items = plan.inventory ?? [];
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const item of items) {
    if (!ID.test(item.id)) {
      problems.push(`inventory "${item.id}": an id is lowercase letters, digits, - and _`);
    }

    if (ids.has(item.id) || known.has(item.id)) {
      problems.push(`inventory "${item.id}" is listed twice: one piece, one id`);
    }

    ids.add(item.id);
  }

  const covered = new Map<string, string[]>();
  for (const task of plan.tasks) {
    for (const line of task.acceptance) {
      for (const id of coversOf(line)) {
        if (!ids.has(id) && !known.has(id)) {
          problems.push(`Task "${task.id}" covers "${id}", which the inventory does not list`);
        }

        covered.set(id, [...(covered.get(id) ?? []), task.id]);
      }
    }
  }

  for (const item of items) {
    const by = covered.get(item.id) ?? [];
    if (item.leftOut !== undefined && by.length > 0) {
      problems.push(
        `inventory "${item.id}" is left out ("${item.leftOut}") and covered by ${by.map(id => `"${id}"`).join(', ')}: one or the other`
      );
    } else if (item.leftOut === undefined && by.length === 0) {
      problems.push(
        `inventory "${item.id}" (${item.piece}${item.page ? `, ${item.page}` : ''}) is in no task's checked acceptance and not left out: give a task a line that proves it — { said, check, covers: ["${item.id}"] } — or say why it waits ("leftOut": "…")`
      );
    }
  }

  return problems;
};

/** The pieces the inventory leaves out, as the plan's `leftOut` lines are said. */
export const inventoryLeftOut = (plan: Pick<RunPlan, 'inventory'>): string[] =>
  (plan.inventory ?? []).flatMap(item =>
    item.leftOut === undefined ? [] : [`${item.piece}${item.page ? ` (${item.page})` : ''} — ${item.leftOut}`]
  );

/** Each piece, and the tasks that cover it: what the report says the run did of the job. */
export const coverage = (
  plan: Pick<RunPlan, 'inventory'>,
  tasks: readonly Pick<PlannedTask, 'id' | 'acceptance'>[]
): { item: InventoryItem; by: string[] }[] =>
  (plan.inventory ?? []).map(item => ({
    item,
    by: tasks.filter(task => task.acceptance.some(line => coversOf(line).includes(item.id))).map(task => task.id)
  }));
