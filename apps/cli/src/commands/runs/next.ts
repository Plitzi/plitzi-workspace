import path from 'node:path';

import chalk from 'chalk';

import { act, runOf } from './shell';
import { messageLines } from './text';
import { FOLLOW_MS } from '../../options';
import { DESIGN_LOOK } from '../../runs/design';
import { isPrincipal } from '../../runs/leads';
import { acceptanceText } from '../../runs/model';
import { copyOf } from '../../runs/paths';
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
            options.follow ? { timeoutMs: options.timeout ?? FOLLOW_MS } : undefined
          );

          return { ...next, agent: ctx.agent, ...(taken ? { taken } : {}) };
        },
        answer =>
          answer.taken ? [...handOffLines(answer), takenText(answer.taken)].join('\n') : nextText(answer, answer.agent)
      )
    : act(
        options,
        async ctx => ({
          ...(options.follow
            ? await followNext(ctx, await runOf(ctx, options), options.role, {
                timeoutMs: options.timeout ?? FOLLOW_MS
              })
            : await nextTask(ctx, await runOf(ctx, options), options.role)),
          agent: ctx.agent
        }),
        answer => nextText(answer, answer.agent)
      );

/** The earlier reviews' notes, counted: the last one's are what this round answers. */
const earlierText = (review: { earlier: number; task: { id: string } }): string[] =>
  review.earlier > 0
    ? [chalk.dim(`  …and ${String(review.earlier)} note(s) of earlier rounds: plitzi task show ${review.task.id}`)]
    : [];

/** A designer's review, as `task next` hands it: what to look at, what for, and how to say it. */
const designReviewText = (review: NonNullable<NextTask['designReview']>): string =>
  [
    chalk.bold(
      `Review ${review.task.id}'s UI — ${review.task.title}: a designer's look, before the lead's${review.round > 0 ? ` (round ${String(review.round)}: sent back since)` : ''}`
    ),
    // Said first, on its own, on the first review alone: in the middle of a line, every time, velada-backlog's design-1
    // read it after its first verdict.
    ...(review.first
      ? [chalk.yellow(`  Your first review: read these first, whole — ${DESIGN_READING.join(', ')}`)]
      : []),
    ...review.asked.map(line => `  ↺ ${line}`),
    ...(review.before
      ? [
          chalk.yellow(
            `  The round before was ${review.before}'s: check that what it asked is done, and ask anew only what is broken — anything else you would change is the next run's (plitzi run notice "…"), not another round`
          )
        ]
      : []),
    ...earlierText(review),
    `  It changed: ${review.changed.join(', ') || 'nothing said'} — in its copy, ${review.copy}`,
    // Beside the run before it, measured — its dress too — and the copy served for it: what a designer rebuilt by hand.
    `  Look at it as it went to review, beside the run before it: plitzi task look ${review.task.id} ${review.pages.length > 0 ? review.pages.join(' ') : '<page…>'} --before${review.pages.length > 0 ? '' : '   # no page of the space owns its files: name the ones it shows on'}`,
    `  Look for (${review.precision}, as the team asks — options.designReview) ${DESIGN_LOOK[review.precision]}`,
    `  Send it back only for what its title and acceptance cover — anything beyond it is plitzi run notice "…", never a round: ${review.task.acceptance.map(acceptanceText).join(' · ')}`,
    // What its own checks measured at complete: the review starts from what fails, not by measuring all of it again.
    ...review.accepted.map(
      result => `    ${result.ok ? chalk.green('✓') : chalk.red('✗')} ${result.said}  ${chalk.dim(`[${result.check}]`)}`
    ),
    ...(review.lastRound
      ? [
          chalk.yellow(
            '  ⚠ Its last round: changes asked now block it for the lead to decide — ask for all that is left, or approve with a note'
          )
        ]
      : []),
    `  Then say it: plitzi task review ${review.task.id} --approve [--note "what you saw"] | --changes "what, where, and why" [--on <element>] --token <your token>`
  ].join('\n');

/** A spike, as `task next --role lead` hands it to a lead: what to find out, for whom, and how to say it. */
const spikeText = (spike: NonNullable<NextTask['spike']>): string =>
  [
    chalk.blue(chalk.bold(`Spike ${spike.task.id} — ${spike.task.title}: find out ${spike.question}`)),
    ...(spike.findings > 0
      ? [`  ${String(spike.findings)} finding(s) of it already: plitzi task context ${spike.task.id}`]
      : []),
    '  Compare with the original (page shot <path> --compare <original> --clip <section> --dress), read its computed styles, measure — write nothing of the task’s',
    `  Then say it — the layers, their values, which file gets each — and its result, the tasks it makes, each with its "findings": plitzi task spike ${spike.task.id} --done "…" --tasks <stage.json> --token <your token>`
  ].join('\n');

/** A lead's review, as `task next --role lead` hands it: the whole review `lead` would make, by this lead. */
const leadReviewText = (review: NonNullable<NextTask['leadReview']>, agent: string): string =>
  [
    chalk.bold(
      `Review ${review.task.id} — ${review.task.title}${review.round > 0 ? ` (round ${String(review.round + 1)}: sent back before)` : ''}: yours, no other lead takes it`
    ),
    ...(review.design ? [`  ✓ ${review.design}`] : []),
    ...(review.uiToo ? [chalk.yellow(`  ⚠ ${review.uiToo}`)] : []),
    ...review.asked.map(line => `  ↺ ${line}`),
    ...earlierText(review),
    `  It changed: ${review.changed.join(', ') || 'nothing said'} — in its copy, ${review.copy}`,
    `  What went to review, against its acceptance: plitzi task show ${review.task.id}`,
    // Its UI said by a designer, the lead's is the code: the look is for what the code changes on a page, if anything.
    review.design
      ? `  Its UI is reviewed: yours is the code, the acceptance and the edge cases — look (plitzi task look ${review.task.id}) only where the code changes what a page does`
      : `  Look at it as it went to review: plitzi task look ${review.task.id} ${review.pages.length > 0 ? review.pages.join(' ') : '<page…>'}`,
    ...(review.lastRound
      ? [
          chalk.yellow(
            '  ⚠ Its last round: changes asked now block it for the lead to decide — ask for all that is left, or approve with a note'
          )
        ]
      : []),
    `  Then say it: plitzi task review ${review.task.id} --approve [--note "…"] | --changes "what, where, and why" --token <your token>`,
    ...(isPrincipal(agent)
      ? []
      : ['  The plan, the person and the finish are lead’s: what you find beyond the task, tell lead'])
  ].join('\n');

/** A question to the lead, as `task next --role lead` hands it to a lead that reviews: what to answer, and how. */
const questionText = (question: NonNullable<NextTask['question']>): string =>
  [
    chalk.bold(
      `Question ${question.id} from ${question.task}${question.agent ? ` (${question.agent})` : ''}: ${question.text}`
    ),
    `  ${question.agent ?? 'its agent'} waits for it. Answer what the code, the plan, the brief or the original answers — read them first (plitzi task show ${question.task})`,
    `  Then: plitzi task message ${question.task} "…" --reply-to ${question.id} --token <your token>`,
    '  A choice for the person, or a change of plan, is lead’s: leave it — lead is woken for it if it is not answered in 2 min'
  ].join('\n');

/** A rework taken over: whose it was, and what its review asked — what this agent's round answers. */
const handOffLines = (next: NextTask): string[] =>
  next.handOff && next.task
    ? [
        chalk.bold(
          `${next.task.id}'s changes, taken over from ${next.handOff.from} (at ${next.handOff.at}, it waited): its copy is the version that went to review — redo what its review asked`
        ),
        ...(next.asked ?? []).map(line => `  ↺ ${line}`)
      ]
    : [];

const nextText = (next: NextTask, agent: string): string =>
  [
    ...messageLines(next.messages),
    next.question
      ? questionText(next.question)
      : next.spike
        ? spikeText(next.spike)
        : next.leadReview
          ? leadReviewText(next.leadReview, agent)
          : next.designReview
            ? designReviewText(next.designReview)
            : next.task
              ? next.yours
                ? [
                    `Yours to go on with: ${next.task.id} — ${next.task.title} (${next.yours === 'changes-requested' ? 'changes requested' : next.back === 'unblocked' ? 'unblocked by the lead' : 'still in progress: you hold it — go on with it before anything new'}). Your token is still good: plitzi task context ${next.task.id}`,
                    ...(next.work ? [`  Its copy, the only place you write: cd ${next.work}`] : []),
                    ...(next.asked ?? []).map(line => `  ↺ ${line}`)
                  ].join('\n')
                : next.handOff
                  ? [...handOffLines(next), '  Take it over: plitzi task next --take'].join('\n')
                  : [
                      `Next: ${next.task.id} — ${next.task.title} (${next.task.priority}, ${next.task.role ?? 'developer'}). Take it: plitzi task take ${next.task.id}`,
                      ...(next.handedBy
                        ? [
                            `  Handed to you by ${next.handedBy.by}, taken back from another${next.handedBy.reason ? `: ${next.handedBy.reason}` : ''} — no other agent takes it`
                          ]
                        : [])
                    ].join('\n')
              : [
                  String(next.why),
                  ...(next.worked ?? []).map(
                    each =>
                      `  ${each.task}: ${each.status === 'done' ? 'approved' : each.status === 'in-review' ? 'with the lead, in review' : each.status}${each.finishedBy ? ` — as ${each.finishedBy} last did it, not your version` : ''}`
                  )
                ].join('\n'),
    // Wherever the answer leaves an agent without a copy of a task in hand — between tasks, at a review.
    ...(next.task && !next.leadReview && !next.designReview
      ? []
      : [chalk.dim(`  What is yours beside the work (a script, a log): ${next.scratch} — never the project's tmp/`)])
  ].join('\n');

/** The project's own `plitzi`, by its whole path — what a command from the copy calls fastest (npx adds ~0.2 s). */
const binLine = (work: string): string[] => {
  const root = copyOf(work)?.root;

  return root
    ? [
        `  The quickest plitzi, from anywhere: ${path.join(root, 'node_modules', '.bin', 'plitzi')} (npx adds ~0.2 s a call)`
      ]
    : [];
};

const takenText = (taken: TakenTask): string =>
  [
    chalk.bold(`Task "${taken.task.id}" is yours: ${taken.task.title}`),
    ...messageLines(taken.messages),
    ...taken.proposals.map(each =>
      chalk.cyan(`  ⇄ ${each.from} proposes (${each.id}): ${each.change} — plitzi task answer ${each.id}`)
    ),
    `  Write only in its copy: ${taken.work} — what is yours beside the work (a script, a log, a picture) in its tmp/, never the project's`,
    `  Its files: ${taken.files.join(', ')}`,
    ...(taken.resumedFrom !== undefined ? [`  Resumed from the version review ${String(taken.resumedFrom)} saw`] : []),
    `  Run its commands in its copy — cd ${taken.work} — with your token, and they know the task: start with plitzi task context`,
    ...binLine(taken.work),
    '  Done: plitzi task complete, in the copy'
  ].join('\n');

export const taskTake = (taskId: string, options: RunCommandOptions & { role?: string }): Promise<void> =>
  act(
    options,
    async ctx => {
      const runId = await runOf(ctx, options);
      const taken = await takeTask(ctx, runId, taskId, options.role);

      return { ...taken, run: runId };
    },
    takenText
  );
