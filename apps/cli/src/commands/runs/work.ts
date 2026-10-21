import chalk from 'chalk';

import { act, either, holder, runOf } from './shell';
import { hhmm, list, messageLines } from './text';
import { crossed, longFileText } from '../../runs/longFiles';
import { RunRefusal } from '../../runs/refusal';
import { tellLead } from '../../runs/talk';
import { blockTask, checkTask, completeTask, noteTask, reportProgress, unblockTask } from '../../runs/tasks';

import type { RunCommandOptions } from './shell';
import type { Needs } from '../../runs/model';

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
  options: RunCommandOptions & { reason: string; needs?: Needs }
): Promise<void> =>
  act(
    options,
    async ctx => {
      const target = await either(ctx, options, taskId);
      const needs = options.needs ?? 'person';
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

export const taskCheck = (options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const { runId, taskId } = await holder(ctx, options);

      return checkTask(ctx, runId, taskId);
    },
    checked =>
      [
        ...messageLines(checked.messages),
        ...(checked.brought
          ? [
              `Brought into your copy first — approved by the run, or changed in the project, since it was made: ${checked.brought.join(', ')}`
            ]
          : []),
        checked.ok
          ? chalk.green('Your copy passes what complete holds it to: complete it when it is done')
          : chalk.yellow(
              'Your copy does not pass yet — none of your work was changed, and nothing counted against the run:'
            ),
        ...checked.checks.steps.map(
          step =>
            `  ${step.ok ? '✓' : chalk.yellow('✗')} ${step.name}${step.ok ? '' : `\n${(step.said ?? []).map(line => `      ${line}`).join('\n')}`}`
        ),
        ...checked.checks.steps.flatMap(step =>
          (step.warnings ?? []).map(warning => chalk.yellow(`  ⚠ ${step.name} warns: ${warning}`))
        ),
        ...checked.accepted.map(
          each =>
            `  ${each.ok ? '✓' : chalk.yellow('✗')} acceptance — ${each.said}  ${chalk.dim(`[${each.check}]`)}${each.ok || !each.output ? '' : `\n${each.output.map(line => `      ${line}`).join('\n')}`}`
        ),
        ...checked.tooLong.map(each => chalk.yellow(`  ✗ ${each}`))
      ].join('\n'),
    checked => (checked.ok ? 0 : 1)
  );

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
            ? `  Checks passed: ${list(completed.checks.steps.map(step => step.name))}`
            : chalk.yellow(
                `  Checks failing, as you said (--known-failure): ${list(completed.checks.steps.filter(step => !step.ok).map(step => step.name))}`
              ),
        ...completed.checks.steps.flatMap(step =>
          (step.warnings ?? []).map(warning =>
            chalk.yellow(
              `  ⚠ ${step.name} warns: ${warning} — fix what this task brought, or tell the lead why it stays`
            )
          )
        ),
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
        '  Take no other step on it until the review: plitzi task next for another.'
      ].join('\n')
  );
