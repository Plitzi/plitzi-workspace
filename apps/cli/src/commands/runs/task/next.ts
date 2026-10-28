import path from 'node:path';

import chalk from 'chalk';

import { FOLLOW_MS } from '../../../options';
import { isPrincipal } from '../../../runs/agents/leads';
import { DESIGN_LOOK, DESIGNER } from '../../../runs/agents/team';
import { acceptanceText } from '../../../runs/core/model';
import { copyOf } from '../../../runs/core/paths';
import { acceptanceAccount, acceptanceAddresses, acceptanceStatuses, filledPattern } from '../../../runs/plan/pagesOf';
import { DESIGN_READING } from '../../../runs/plan/reading';
import { isResearch, roleOf } from '../../../runs/plan/spike';
import { nextTask, takeNext, takeTask } from '../../../runs/tasks';
import { projectExec } from '../../../scaffold/packageManager';
import { act, runOf } from '../shell';
import { briefText, readBrief } from './brief';
import { shownText } from './show';
import { showTask } from '../../../runs/view/show';
import { takeOnRead } from '../review/takeOnRead';
import { BEFORE_STOP, messageLines } from '../text';

import type { Brief } from './brief';
import type { RunTask } from '../../../runs/core/model';
import type { NextTask, TakenTask } from '../../../runs/tasks';
import type { RunCommandOptions } from '../shell';

/**
 * `plitzi task next`, and `task next <task>`: what an agent is handed, said.
 */

/**
 * Taken and waited for unless told: an agent's every `task next` was `--follow --take` (130 of 138 in two runs) — the
 * lead's queue of reviews answers now (`--no-wait`), and a look ahead takes nothing (`--peek`).
 */
export const taskNext = (
  options: RunCommandOptions & { role?: string; wait: boolean; peek?: boolean; timeout?: number }
): Promise<void> => {
  const follow = options.wait && options.peek !== true;

  return options.peek !== true
    ? act(
        options,
        async ctx => {
          const runId = await runOf(ctx, options);
          const { next, taken } = await takeNext(
            ctx,
            runId,
            options.role,
            follow ? { timeoutMs: options.timeout ?? FOLLOW_MS } : undefined
          );

          // The brief with the task: every agent asked for it next, a turn a task — read as its holder, by the token
          // the take gave.
          const brief = taken ? await readBrief({ ...ctx, token: taken.token }, runId, taken.task.id) : undefined;
          // …and a review with what went to it: every reviewer asked `task show` next, a turn a review. Read, it is
          // taken, as a show of it takes it.
          const reviewing = next.review?.found === undefined ? next.review?.task.id : undefined;
          const reviewed =
            reviewing === undefined
              ? undefined
              : await takeOnRead(ctx, runId, reviewing).then(() => showTask(ctx, runId, reviewing));

          return {
            ...next,
            agent: ctx.agent,
            ...(taken ? { taken: { ...taken, ...(brief ? { brief } : {}) } } : {}),
            ...(reviewed ? { shown: reviewed } : {})
          };
        },
        answer =>
          answer.taken
            ? takenText(answer.taken)
            : [nextText(answer, answer.agent), ...(answer.shown ? ['', shownText(answer.shown)] : [])].join('\n')
      )
    : act(
        options,
        async ctx => ({ ...(await nextTask(ctx, await runOf(ctx, options), options.role)), agent: ctx.agent }),
        answer => nextText(answer, answer.agent)
      );
};

/** The earlier reviews' notes, counted: the last one's are what this round answers. */
const earlierText = (review: { earlier: number; task: { id: string } }): string[] =>
  review.earlier > 0
    ? [chalk.dim(`  …and ${String(review.earlier)} note(s) of earlier rounds: plitzi task show ${review.task.id}`)]
    : [];

/**
 * The look a review starts from, as `task next` offers it: its pages signed in as its acceptance checks them, and a
 * page its acceptance checks with a status of its own looked at with it — a run's offer left out t-retro-pass's 404.
 */
const lookCommand = (task: RunTask, drawnAt: readonly string[], also: string): string[] => {
  // A route's pattern offered as an address its acceptance names: a run's designer was handed `/messages/:username`.
  const named = acceptanceAddresses(task.acceptance);
  // Each page once, and a route no address fills left to the look, which follows the site's links to one: offered as
  // the pattern, a run's look could not reach it.
  const filled = [...new Set(drawnAt.map(page => filledPattern(page, named)))];
  const pages = filled.filter(page => !page.includes('/:'));
  const unfilled = filled.filter(page => page.includes('/:'));
  const as = acceptanceAccount(task.acceptance);
  const signedIn = as === undefined ? '' : ` --as ${as}`;
  const byStatus = new Map<number, string[]>();
  for (const { page, status } of acceptanceStatuses(task.acceptance)) {
    byStatus.set(status, [...(byStatus.get(status) ?? []), page]);
  }

  return [
    `plitzi task look ${task.id} ${pages.length > 0 ? pages.join(' ') : '<page…>'}${signedIn}${also}${pages.length > 0 ? '' : '   # no page of the space owns its files: name the ones it shows on'}${unfilled.length > 0 ? `   # and ${unfilled.join(', ')}: name an address of ${unfilled.length === 1 ? 'it' : 'each'}` : ''}`,
    ...[...byStatus].map(
      ([status, pages]) => `plitzi task look ${task.id} ${pages.join(' ')} --status ${String(status)}`
    )
  ];
};

/**
 * A review, as `task next` hands it — whatever step it is, a designer's look or a tester's QA: what to look at, what for,
 * and how to say it.
 */
const reviewText = (review: NonNullable<NextTask['review']>, agent: string): string =>
  [
    chalk.bold(
      `Review ${review.task.id} — ${review.task.title}: its ${review.role}'s review${review.steps.length > 1 ? ` (step ${String(review.step + 1)} of ${String(review.steps.length)}: ${review.steps.join(' → ')})` : ''}${review.round > 0 ? ` — round ${String(review.round + 1)}, sent back before` : ''}`
    ),
    // Said first, on its own, on the first review alone: in the middle of a line, every time, a run's design-1
    // read it after its first verdict.
    ...(review.first && review.role === DESIGNER
      ? [chalk.yellow(`  Your first review: read these first, whole — ${DESIGN_READING.join(', ')}`)]
      : []),
    ...(review.passed ?? []).map(line => `  ✓ ${line}`),
    ...(review.told ?? []).map(line => `  ✉ ${line}`),
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
    // A designer's look is set beside the run before it, measured — its dress too; any other looks at it as it went.
    ...(review.noPage
      ? [
          `  It changes no page — nothing to picture: its acceptance, before it and with it, says what it proves: plitzi task prove ${review.task.id} --before`
        ]
      : lookCommand(review.task, review.pages, review.role === DESIGNER ? ' --before' : '').map(
          (command, index) =>
            `  ${index === 0 ? `Look at it as it went to review${review.role === DESIGNER ? ', beside the run before it' : ''}` : 'And'}: ${command}`
        )),
    review.precision
      ? `  Look for (${review.precision}, as the team asks — options.designReview) ${DESIGN_LOOK[review.precision]}`
      : `  Its QA: what it was asked, its checks, how it behaves (a control used there and back, a state the data opens), the code and the edge cases — what went to review is below (a file whole: plitzi task show ${review.task.id} <file> --diff)`,
    `  Send it back only for what its title, acceptance and brief ask — what was found for it, a 'do X, not Y' — anything beyond it is plitzi run notice "…", never a round: ${review.task.acceptance.map(acceptanceText).join(' · ')}`,
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
    `  Then say it: plitzi task review ${review.task.id} --approve [--note "what you saw"] | --changes "what, where, and why" [--on <element>]${review.step + 1 < review.steps.length ? ` — approved, its ${review.steps.at(review.step + 1) ?? ''}'s review is next` : ''}`,
    ...(isPrincipal(agent)
      ? []
      : [
          `  What you cannot decide — what was asked reads two ways, a change past the task, a disagreement with its developer — is the lead's: plitzi task review ${review.task.id} --escalate "…"; what you find beyond the task, tell the lead (plitzi task tell --about ${review.task.id} "…")`
        ])
  ].join('\n');

/** What the lead finds out itself: an agent's question it answers, or research with no scout in the team. */
const spikeText = (spike: NonNullable<NextTask['spike']>): string =>
  [
    chalk.blue(chalk.bold(`${spike.task.id} — ${spike.task.title}: find out ${spike.question}`)),
    ...(spike.findings > 0
      ? [`  ${String(spike.findings)} finding(s) of it already: plitzi task context ${spike.task.id}`]
      : []),
    // A copy's research compares with the original; any other reads the project — a run's spike on test speed was
    // told to compare with an original it had none of.
    spike.reference === undefined
      ? '  Read the code and the pages, measure, run what tells — write nothing of the task’s'
      : `  Compare with the original (page shot <path> --compare ${spike.reference} --within <section> --dress), read its computed styles, measure — write nothing of the task’s`,
    spike.blocking
      ? `  ${spike.task.id} is blocked on it, at work: lift its block with what you found — plitzi task unblock ${spike.task.id} --answer "…" (kept as its finding)`
      : `  Then say it — the layers, their values, which file gets each — and its result, the tasks it makes, each with its "findings": plitzi task complete ${spike.task.id} --found "…" [--tasks <stage.json>]`
  ].join('\n');

/** What a research card found, as the lead's review of it: decided — the tasks with the person — and approved. */
const foundText = (
  review: NonNullable<NextTask['review']>,
  found: NonNullable<NonNullable<NextTask['review']>['found']>
): string =>
  [
    chalk.blue(
      chalk.bold(
        `${review.task.id} — ${found.by} found it out${found.tasks.length > 0 ? `, and proposes ${String(found.tasks.length)} task(s): ${found.tasks.join(', ')}` : ''}`
      )
    ),
    `  Found: ${found.text}`,
    ...(found.tasks.length > 0
      ? [
          `  Read them as they would stack: plitzi run open ${found.stage} --dry-run`,
          '  Decide them with the person — the scope, what waits, what is left out — then:'
        ]
      : []),
    `  plitzi task review ${review.task.id} --approve [--leave <tasks>] | --changes "what to change" (back to ${found.by})`
  ].join('\n');

export const nextText = (next: NextTask, agent: string): string =>
  [
    next.spike
      ? spikeText(next.spike)
      : next.review
        ? next.review.found
          ? foundText(next.review, next.review.found)
          : reviewText(next.review, agent)
        : next.task
          ? next.yours
            ? [
                `Yours to go on with: ${next.task.id} — ${next.task.title} (${next.yours === 'changes-requested' ? 'changes requested' : next.back === 'unblocked' ? 'unblocked by the lead' : 'still in progress: you hold it — go on with it before anything new'}). Your token is still good: plitzi task context ${next.task.id}`,
                ...(next.work
                  ? [
                      isResearch(next.task)
                        ? `  Its copy, where its commands run — research writes nothing of the project's: cd ${next.work}`
                        : `  Its copy, the only place you write: cd ${next.work}`
                    ]
                  : []),
                ...(next.asked ?? []).map(line => `  ↺ ${line}`)
              ].join('\n')
            : [
                `Next: ${next.task.id} — ${next.task.title} (${next.task.priority}, ${roleOf(next.task)}). Take it: plitzi task next ${next.task.id}`,
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
                  `  ${each.task}: ${each.status === 'done' ? 'approved' : each.status === 'in-review' ? 'in review' : each.status}${each.finishedBy ? ` — as ${each.finishedBy} last did it, not your version` : ''}`
              ),
              // A run's dev-1 met four of Plitzi's frictions and said them only in its last words, which the
              // run's feedback never reads.
              ...(next.finished ? [BEFORE_STOP] : [])
            ].join('\n'),
    // Wherever the answer leaves an agent without a copy of a task in hand — between tasks, at a review.
    ...(next.task && !next.review
      ? []
      : [chalk.dim(`  What is yours beside the work (a script, a log): ${next.scratch} — never the project's tmp/`)]),
    ...messageLines(next.messages)
  ].join('\n');

/** The project's own `plitzi`, by its whole path — what a command from the copy calls fastest (npx adds ~0.2 s). */
const binLine = (work: string): string[] => {
  const root = copyOf(work)?.root;

  return root
    ? [
        `  The quickest plitzi, from anywhere: ${path.join(root, 'node_modules', '.bin', 'plitzi')} (${projectExec('plitzi')} adds ~0.2 s a call)`
      ]
    : [];
};

const takenText = (taken: TakenTask & { brief?: Brief }): string =>
  [
    chalk.bold(`Task "${taken.task.id}" is yours: ${taken.task.title}`),
    ...taken.proposals.map(each =>
      chalk.cyan(`  ⇄ ${each.from} proposes (${each.id}): ${each.change} — plitzi task answer ${each.id}`)
    ),
    isResearch(taken.task)
      ? `  Its copy, where its commands run: ${taken.work} — research writes nothing of the project's; your notes and the stage you propose go in its tmp/`
      : `  Write only in its copy: ${taken.work} — what is yours beside the work (a script, a log, a picture) in its tmp/, never the project's`,
    ...(isResearch(taken.task)
      ? [
          `  Research: find out ${taken.task.spike ?? 'what it asks'}`,
          // A copy's research compares with the original; any other reads the project — a run's spike on test
          // speed was told to compare with an original it had none of.
          ...(taken.reference === undefined
            ? []
            : [
                `  Compare with the original (page shot <path> --compare ${taken.reference} --within <section> --dress), read its computed styles, measure`
              ])
        ]
      : [`  Its files: ${taken.files.join(', ')}`]),
    ...(taken.resumedFrom !== undefined ? [`  Resumed from the version review ${String(taken.resumedFrom)} saw`] : []),
    taken.brief === undefined
      ? `  Run its commands in its copy — cd ${taken.work} — with your token, and they know the task: start with plitzi task context`
      : `  Run its commands in its copy — cd ${taken.work} — with your token, and they know the task: its brief is below (plitzi task context --files adds its files whole)`,
    ...binLine(taken.work),
    isResearch(taken.task)
      ? '  See your stage first — each line run once: plitzi run open <stage.json> --dry-run --lines; done: plitzi task complete --found "…" [--tasks <stage.json>], in the copy — the lead approves it'
      : '  Done: plitzi task check --fix (what lint and format fix by themselves, first), then plitzi task complete — in the copy',
    ...messageLines(taken.messages),
    ...(taken.brief === undefined ? [] : ['', briefText(taken.brief)])
  ].join('\n');

export const taskTake = (taskId: string, options: RunCommandOptions & { role?: string }): Promise<void> =>
  act(
    options,
    async ctx => {
      const runId = await runOf(ctx, options);
      const taken = await takeTask(ctx, runId, taskId, options.role);
      const brief = await readBrief({ ...ctx, token: taken.token }, runId, taken.task.id);

      return { ...taken, brief, run: runId };
    },
    takenText
  );
