import path from 'node:path';

import { PROJECT_TMP } from '@plitzi/sdk-shared/project';

import { failedWhy } from '../../commands/project/verify';
import { checkAcceptance } from '../copies/acceptance';
import { acceptanceOnResult } from '../copies/materialise';
import { readApproved } from '../run';

import type { AcceptanceResult, RunPlan, RunTask } from '../core/model';
import type { LoadedRun, RunContext } from '../run';

/**
 * A stage's acceptance lines run once on the run's work as it is — before an agent tries any — each said for what it
 * is: what the task is to change, a part it builds, or a line that cannot pass for a reason of its own. A run's
 * lead dry-ran its 13 lines by hand (2.5 min) and four of a later stage's were never run on ours: 16 checks of one task
 * failed on the lines, not the work.
 */

export type LineVerdict =
  /** It passes already: it holds nothing until the work would break it — a line that guards, or one to make stricter. */
  | 'passes'
  /** It fails for its value: what the task is to change. */
  | 'value'
  /** An element of ours it reads is not drawn yet: the task makes it — the name must be the one it will write. */
  | 'ours-missing'
  /** An element of the other site it reads is not there: the line is wrong, whatever the work. */
  | 'theirs-missing'
  /** Its command could not run it: a selector it cannot read, a flag it refuses. */
  | 'refused';

export interface TriedLine {
  task: string;
  said: string;
  verdict: LineVerdict;
  /** What its command said last, for a line that could not be answered. */
  why?: string;
}

/** What a command prints for an element it did not find: `<name> is not on <url>`, `No element <name> on <url>`. */
const MISSING = /(?:is not on|No element \S+ on)\s+(https?:\/\/\S+)/;

/** A line's verdict from what its command answered, the other site's origin telling whose element was missing. */
export const verdictOf = (result: AcceptanceResult, reference: string | undefined): LineVerdict => {
  if (result.ok) {
    return 'passes';
  }

  if (!result.unanswered) {
    return 'value';
  }

  const missing = (result.output ?? []).map(line => MISSING.exec(line)?.[1]).find(url => url !== undefined);
  if (missing === undefined) {
    return 'refused';
  }

  return reference !== undefined && new URL(missing).origin === new URL(reference).origin
    ? 'theirs-missing'
    : 'ours-missing';
};

/** Each checked line of `tasks`, run on the run's approved work, with its verdict. */
export const tryLines = async (ctx: RunContext, loaded: LoadedRun, tasks: readonly RunTask[]): Promise<TriedLine[]> => {
  const lines = tasks.flatMap(task =>
    task.acceptance.flatMap(line =>
      typeof line === 'string' ? [] : [{ task: task.id, said: line.said, check: line.check }]
    )
  );
  if (lines.length === 0) {
    return [];
  }

  const approved = await readApproved(loaded.paths);
  const versions = Object.fromEntries(Object.entries(approved.files).map(([file, entry]) => [file, entry.digest]));
  const { results } = await acceptanceOnResult(ctx, loaded, versions, lines);

  return results.map(result => {
    const verdict = verdictOf(result, loaded.plan.reference);
    const why = failedWhy(result.output);

    return {
      task: result.task,
      said: result.said,
      verdict,
      ...(verdict === 'refused' || verdict === 'theirs-missing' ? (why ? { why } : {}) : {})
    };
  });
};

/** The lines of `tasks` that a command checks, each once, with its task. */
const checkedLines = (tasks: readonly Pick<RunTask, 'id' | 'acceptance'>[]) =>
  tasks.flatMap(task =>
    task.acceptance.flatMap(line =>
      typeof line === 'string' ? [] : [{ task: task.id, said: line.said, check: line.check }]
    )
  );

/**
 * A first plan's lines, tried on the project as it is — no run open to try them on: what a run's lead did by hand,
 * each check of the plan looped over with PLITZI_URL, before opening, the moment the lines matter most.
 */
export const tryLinesOnProject = async (
  ctx: RunContext,
  plan: { tasks: readonly Pick<RunTask, 'id' | 'acceptance'>[]; reference?: RunPlan['reference'] }
): Promise<TriedLine[]> => {
  const lines = checkedLines(plan.tasks);
  if (lines.length === 0) {
    return [];
  }

  const results = await checkAcceptance(lines, {
    work: ctx.root,
    root: ctx.root,
    cache: path.join(ctx.root, PROJECT_TMP, 'plitzi-cache', 'lines')
  });

  return results.map((result, index) => {
    const verdict = verdictOf(result, plan.reference);
    const why = failedWhy(result.output);

    return {
      task: lines[index]?.task ?? '',
      said: result.said,
      verdict,
      ...(verdict === 'refused' || verdict === 'theirs-missing' ? (why ? { why } : {}) : {})
    };
  });
};

const SAID: Record<LineVerdict, string> = {
  passes: 'passes already — it holds nothing until the work would break it: one that guards, or one to make stricter',
  value: 'fails for its value — what the task is to change',
  'ours-missing': 'reads an element not drawn yet — the task makes it: its name is the one it will write',
  'theirs-missing': 'the other site has no element it reads — the line is wrong, whatever the work: fix it',
  refused: 'its command cannot run it — fix the line'
};

/** The lines tried, one a line, the ones to fix first. */
export const triedText = (tried: readonly TriedLine[]): string[] => {
  const order: readonly LineVerdict[] = ['theirs-missing', 'refused', 'passes', 'ours-missing', 'value'];

  return [...tried]
    .sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict))
    .map(line => `  ${line.task}: ${line.said} — ${SAID[line.verdict]}${line.why ? ` (${line.why})` : ''}`);
};
