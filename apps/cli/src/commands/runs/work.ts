import chalk from 'chalk';

import { act, either, holder, runOf } from './shell';
import { hhmm, list, messageLines, secondRunText } from './text';
import { crossed, longFileText } from '../../runs/longFiles';
import { RunRefusal } from '../../runs/refusal';
import { tellLead } from '../../runs/talk';
import { blockTask, checkTask, completeTask, noteTask, reportProgress, unblockTask } from '../../runs/tasks';

import type { RunCommandOptions } from './shell';
import type { BLOCK_NEEDS } from '../../runs/model';

/**
 * A task at work: its progress, a block and its answer, a note, and its completion.
 */

export const taskProgress = (options: RunCommandOptions & { fraction?: number; step?: string }): Promise<void> =>
  act(
    options,
    async ctx => {
      const { runId, taskId } = await holder(ctx, options);

      return reportProgress(ctx, runId, taskId, {
        ...(options.fraction !== undefined ? { fraction: options.fraction } : {}),
        ...(options.step !== undefined ? { step: options.step } : {})
      });
    },
    signal =>
      [
        ...messageLines(signal.messages),
        ...signal.longFiles.map(long =>
          chalk.yellow(
            `  ⚠ ${longFileText(long)}: split it by what changes together — a section or a part per file${crossed(long) ? '; complete refuses it past the line' : ''}`
          )
        ),
        signal.inReview
          ? `${signal.task} is in review: no sign of life is needed until it comes back to you — and what you write in its copy now is not reviewed. Take another task meanwhile: plitzi task next`
          : `${signal.task}: a sign of life at ${hhmm(signal.at)}. Without another, the lead may reassign it after ${hhmm(signal.quietAfter)}, and another agent take it after ${hhmm(signal.takenAfter)}.`
      ].join('\n')
  );

export const taskBlock = (
  taskId: string | undefined,
  options: RunCommandOptions & { reason: string; needs?: (typeof BLOCK_NEEDS)[number] }
): Promise<void> =>
  act(
    options,
    async ctx => {
      const target = await either(ctx, options, taskId);
      const needs = options.needs ?? 'lead';
      await blockTask(ctx, target.runId, target.taskId, options.reason, needs);

      return {
        ...target,
        blocked: { reason: options.reason, needs },
        next: `take another ready task; once unblocked, plitzi task next hands ${target.taskId} back to you first`
      };
    },
    target =>
      `${target.taskId} is blocked (${target.blocked.needs}): ${target.blocked.reason.replace(/[.\s]+$/, '')}. Take another ready task meanwhile; once it is unblocked, plitzi task next hands it back to you first.`
  );

export const taskUnblock = (taskId: string, options: RunCommandOptions & { answer?: string }): Promise<void> =>
  act(
    options,
    async ctx => unblockTask(ctx, await runOf(ctx, options), taskId, options.answer),
    state => `${taskId} is ${state.status} again.`
  );

export const taskNote = (taskId: string | undefined, text: string, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const target = await either(ctx, options, taskId);
      await noteTask(ctx, target.runId, target.taskId, text);

      return target;
    },
    () => 'Noted: whoever takes it next reads it in plitzi task context.'
  );

export const taskCheck = (
  options: RunCommandOptions & { acceptance?: boolean; fix?: boolean; fresh?: boolean }
): Promise<void> =>
  act(
    options,
    async ctx => {
      const { runId, taskId } = await holder(ctx, options);

      return checkTask(ctx, runId, taskId, {
        ...(options.acceptance ? { only: 'acceptance' as const } : {}),
        ...(options.fix ? { fix: true } : {}),
        ...(options.fresh ? { fresh: true } : {})
      });
    },
    checked =>
      [
        ...messageLines(checked.messages),
        ...(checked.brought
          ? [
              `Brought into your copy first — approved by the run, or changed in the project, since it was made: ${checked.brought.join(', ')}`
            ]
          : []),
        ...(checked.fixed
          ? [
              checked.fixed.ran.length === 0
                ? chalk.dim('--fix: the project has no eslint lint script nor prettier format script to fix with')
                : `Fixed first by ${checked.fixed.ran.join(' and ')}: ${checked.fixed.fixed.length > 0 ? checked.fixed.fixed.join(', ') : 'nothing to fix'}`
            ]
          : []),
        ...(checked.only === 'acceptance'
          ? [
              chalk.dim(
                'Its acceptance alone: the project’s checks were not run — plitzi task check runs them all, as complete will'
              )
            ]
          : []),
        checked.ok
          ? chalk.green(
              checked.only === 'acceptance'
                ? 'Its acceptance holds: plitzi task check, then complete'
                : checked.checkedAt
                  ? `Your copy passes — as it did at ${checked.checkedAt.slice(11, 16)} UTC: nothing changed since, so nothing ran again (--fresh runs it). Complete it when it is done`
                  : 'Your copy passes what complete holds it to: complete it when it is done'
            )
          : chalk.yellow(
              checked.fixed
                ? 'Your copy does not pass yet — only what --fix said was changed, and nothing counted against the run:'
                : 'Your copy does not pass yet — none of your work was changed, and nothing counted against the run:'
            ),
        ...checked.checks.steps.map(
          step =>
            `  ${step.ok ? '✓' : chalk.yellow('✗')} ${step.name}${step.ok ? '' : `\n${(step.said ?? []).map(line => `      ${line}`).join('\n')}`}`
        ),
        ...checked.checks.steps.flatMap(step =>
          (step.warnings ?? []).map(warning => chalk.yellow(`  ⚠ ${step.name} warns: ${warning}`))
        ),
        // What the project's linter and formatter fix by themselves is no round of thought: said, with how.
        ...(!checked.fixed &&
        checked.checks.steps.some(step => !step.ok && (step.name === 'lint' || step.name === 'format'))
          ? [
              chalk.dim(
                '  What lint and format fix by themselves: plitzi task check --fix runs them on your files first, then checks'
              )
            ]
          : []),
        ...checked.accepted.map(
          each =>
            `  ${each.ok ? '✓' : chalk.yellow('✗')} acceptance — ${each.said}  ${chalk.dim(`[${each.check}]`)}${secondRunText(each)}${each.ok || !each.output ? '' : `\n${each.output.map(line => `      ${line}`).join('\n')}`}`
        ),
        ...checked.tooLong.map(each => chalk.yellow(`  ✗ ${each}`)),
        ...(checked.othersFiles ?? []).map(each =>
          chalk.yellow(
            `  ✗ ${each.file} is ${each.holder}'s, at work — complete refuses it: put it back (plitzi task discard ${each.file}) and propose the change to ${each.holder} (plitzi task propose ${each.holder} --change "…"), or wait for it (plitzi task wait ${each.file})`
          )
        )
      ].join('\n'),
    checked => (checked.ok ? 0 : 1)
  );

/**
 * The checks' warnings, those on a file this task changed apart from the rest: its own to fix or to say why it stays,
 * and the ones it found in files it never touched, said in a line — every complete of a run listed the same ones as if
 * each task had brought them.
 */
export const warningLines = (
  steps: readonly { name: string; warnings?: string[] }[],
  changed: readonly string[]
): string[] => {
  const all = steps.flatMap(step => (step.warnings ?? []).map(warning => ({ step: step.name, warning })));
  const fileOf = (warning: string): string | undefined => /^([^\s:]+\.[a-z]+)(:\d+)?\b/.exec(warning)?.[1];
  const own = all.filter(each => {
    const file = fileOf(each.warning);

    return file === undefined || changed.includes(file);
  });
  const elsewhere = [...new Set(all.filter(each => !own.includes(each)).map(each => fileOf(each.warning) ?? ''))];

  return [
    // A token declared and read nowhere yet is what a task declares for a later one: as the skill says, no failure —
    // said so, not as something to fix (velada-dress: design-1 read the two as contradicting each other).
    ...own.map(each =>
      chalk.yellow(
        /unused-token/.test(each.warning)
          ? `  ⚠ ${each.step} warns: ${each.warning} — fine if a later task reads it: say which in your --note`
          : `  ⚠ ${each.step} warns: ${each.warning} — fix what this task brought, or tell the lead why it stays`
      )
    ),
    ...(elsewhere.length > 0
      ? [
          chalk.dim(
            `  · ${String(all.length - own.length)} warning(s) in files this task did not change — there before it: ${elsewhere.join(', ')}`
          )
        ]
      : [])
  ];
};

export const taskComplete = (
  options: RunCommandOptions & { knownFailure?: string; fixedBy?: string; note?: string; review?: string }
): Promise<void> =>
  act(
    options,
    async ctx => {
      const { runId, taskId } = await holder(ctx, options);
      if (options.fixedBy && !options.knownFailure) {
        throw new RunRefusal('invalid', '--fixed-by goes with --known-failure "why": the task that fixes what fails');
      }

      if (options.review !== undefined && options.review !== 'code' && options.review !== 'ui') {
        throw new RunRefusal('invalid', `--review is code or ui, not "${options.review}"`);
      }

      const completed = await completeTask(ctx, runId, taskId, {
        ...(options.review === undefined ? {} : { review: options.review }),
        ...(options.knownFailure
          ? { knownFailure: { why: options.knownFailure, ...(options.fixedBy ? { fixedBy: options.fixedBy } : {}) } }
          : {})
      });
      // Told once it is in review, never for a completion refused: the note goes with the work it is about.
      if (options.note !== undefined && options.note.trim() !== '') {
        await tellLead(ctx, runId, taskId, options.note);
      }

      return completed;
    },
    completed =>
      [
        ...messageLines(completed.messages),
        `In review: ${String(completed.changed.length)} files changed (${list(completed.changed)}).`,
        ...(completed.claimed.length > 0
          ? [`  Taken by turns as it completed, free: ${completed.claimed.join(', ')} — they go into the run with it`]
          : []),
        ...(completed.merged.length > 0
          ? [`  Put together with the run's newer version, line by line: ${completed.merged.join(', ')}`]
          : []),
        ...(completed.brought.length > 0
          ? [
              `  Brought into your copy before the checks, approved in the run since it was made: ${completed.brought.join(', ')}`
            ]
          : []),
        ...(completed.requests.length > 0
          ? [`  Requests on shared files: ${completed.requests.map(each => each.file).join(', ')}`]
          : []),
        completed.checks.none
          ? chalk.yellow(`  Not checked: ${completed.checks.none}`)
          : completed.checks.ok
            ? `  Checks passed: ${list(completed.checks.steps.map(step => step.name))}${completed.checkedAt ? ` — as task check passed them at ${completed.checkedAt.slice(11, 16)} UTC, nothing changed since: not run again` : ''}`
            : chalk.yellow(
                // Said as what it is: one with no --known-failure is the run's, not "as you said" (lx-copy's design-2).
                completed.preexisting
                  ? `  Checks failing the same way in the run's work without your task — not yours, the lead is told: ${list(completed.checks.steps.filter(step => !step.ok).map(step => step.name))}`
                  : `  Checks failing, as you said (--known-failure): ${list(completed.checks.steps.filter(step => !step.ok).map(step => step.name))}`
              ),
        ...warningLines(completed.checks.steps, completed.changed),
        ...completed.accepted.map(
          each => `  ${each.ok ? '✓' : chalk.yellow('✗')} acceptance — ${each.said}  ${chalk.dim(`[${each.check}]`)}`
        ),
        ...(completed.changedInProject.length > 0
          ? [
              chalk.yellow(
                `  Changed in the project meanwhile: ${completed.changedInProject.join(', ')} — your work is kept; the lead decides at review (line by line when the two go together)`
              )
            ]
          : []),
        '  Nothing more on it until its review comes back: plitzi task next hands you what is next — a task you hold first.'
      ].join('\n')
  );
