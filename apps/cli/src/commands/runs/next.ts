import chalk from 'chalk';

import { act, runOf } from './shell';
import { messageLines } from './text';
import { DESIGN_LOOK } from '../../runs/design';
import { DESIGN_READING } from '../../runs/reading';
import { nextTask, followNext, takeNext, takeTask } from '../../runs/tasks';

import type { RunCommandOptions } from './shell';
import type { NextTask, TakenTask } from '../../runs/tasks';

/**
 * `plitzi task next` and `task take`: what an agent is handed, said.
 */

export const taskNext = (
  options: RunCommandOptions & { role?: string; follow?: boolean; timeout?: number; take?: boolean }
): Promise<void> =>
  options.take
    ? act(
        options,
        async ctx => {
          const runId = await runOf(ctx, options);
          const { next, taken } = await takeNext(
            ctx,
            runId,
            options.role,
            options.follow ? { timeoutMs: options.timeout ?? 30 * 60_000 } : undefined
          );

          return { ...next, agent: ctx.agent, ...(taken ? { taken } : {}) };
        },
        answer => (answer.taken ? takenText(answer.taken) : nextText(answer, answer.agent))
      )
    : act(
        options,
        async ctx => ({
          ...(options.follow
            ? await followNext(ctx, await runOf(ctx, options), options.role, {
                timeoutMs: options.timeout ?? 30 * 60_000
              })
            : await nextTask(ctx, await runOf(ctx, options), options.role)),
          agent: ctx.agent
        }),
        answer => nextText(answer, answer.agent)
      );

/** A designer's review, as `task next` hands it: what to look at, what for, and how to say it. */
const designReviewText = (review: NonNullable<NextTask['designReview']>, agent: string): string =>
  [
    chalk.bold(
      `Review ${review.task.id}'s UI — ${review.task.title}: a designer's look, before the lead's${review.round > 0 ? ` (round ${String(review.round)}: sent back since)` : ''}`
    ),
    ...review.asked.map(line => `  ↺ ${line}`),
    `  It changed: ${review.changed.join(', ') || 'nothing said'}`,
    `  Look at it as it went to review: plitzi task look ${review.task.id} ${review.pages.length > 0 ? review.pages.join(' ') : '<page…>   # no page of the space owns its files: name the ones it shows on'}`,
    `  Look for ${DESIGN_LOOK} — before your first review, read ${DESIGN_READING.join(', ')}`,
    `  Then say it: plitzi task review ${review.task.id} --approve [--note "what you saw"] | --changes "what, where, and why" [--on <element>] --agent ${agent}`
  ].join('\n');

/** A lead's review, as `task next --role lead` hands it: the whole review `lead` would make, by this lead. */
const leadReviewText = (review: NonNullable<NextTask['leadReview']>, agent: string): string =>
  [
    chalk.bold(
      `Review ${review.task.id} — ${review.task.title}${review.round > 0 ? ` (round ${String(review.round + 1)}: sent back before)` : ''}: yours, no other lead takes it`
    ),
    ...(review.design ? [`  ✓ ${review.design}`] : []),
    ...review.asked.map(line => `  ↺ ${line}`),
    `  It changed: ${review.changed.join(', ') || 'nothing said'}`,
    `  What went to review, against its acceptance: plitzi task show ${review.task.id}`,
    `  Look at it as it went to review: plitzi task look ${review.task.id} ${review.pages.length > 0 ? review.pages.join(' ') : '<page…>'}`,
    `  Then say it: plitzi task review ${review.task.id} --approve [--note "…"] | --changes "what, where, and why" --agent ${agent}`,
    '  Its questions, the plan and the finish are lead’s: what you find beyond the task, tell lead'
  ].join('\n');

const nextText = (next: NextTask, agent: string): string =>
  [
    ...messageLines(next.messages),
    next.leadReview
      ? leadReviewText(next.leadReview, agent)
      : next.designReview
        ? designReviewText(next.designReview, agent)
        : next.task
          ? next.yours
            ? [
                `Yours to go on with: ${next.task.id} — ${next.task.title} (${next.yours === 'changes-requested' ? 'changes requested' : 'unblocked'}). Your token is still good: plitzi task context ${next.task.id}`,
                ...(next.asked ?? []).map(line => `  ↺ ${line}`)
              ].join('\n')
            : `Next: ${next.task.id} — ${next.task.title} (${next.task.priority}, ${next.task.role ?? 'developer'}). Take it: plitzi task take ${next.task.id}`
          : [
              String(next.why),
              ...(next.worked ?? []).map(
                each =>
                  `  ${each.task}: ${each.status === 'done' ? 'approved' : each.status === 'in-review' ? 'with the lead, in review' : each.status}${each.finishedBy ? ` — as ${each.finishedBy} last did it, not your version` : ''}`
              )
            ].join('\n')
  ].join('\n');

const takenText = (taken: TakenTask): string =>
  [
    chalk.bold(`Task "${taken.task.id}" is yours: ${taken.task.title}`),
    ...messageLines(taken.messages),
    ...taken.proposals.map(each =>
      chalk.cyan(`  ⇄ ${each.from} proposes (${each.id}): ${each.change} — plitzi task answer ${each.id}`)
    ),
    `  Write only in its copy: ${taken.work}`,
    `  Its files: ${taken.files.join(', ')}`,
    ...(taken.resumedFrom !== undefined ? [`  Resumed from the version review ${String(taken.resumedFrom)} saw`] : []),
    `  Run its commands in its copy — cd ${taken.work} — and they know the task: start with plitzi task context`,
    `  Anywhere else, its token: --token ${taken.token}`,
    '  Done: plitzi task complete, in the copy'
  ].join('\n');

export const taskTake = (taskId: string, options: RunCommandOptions & { role?: string }): Promise<void> =>
  act(
    options,
    async ctx => {
      const runId = await runOf(ctx, options);
      const taken = await takeTask(ctx, runId, taskId, options.role);

      return { ...taken, run: runId, env: `PLITZI_TASK_TOKEN=${taken.token}` };
    },
    takenText
  );
