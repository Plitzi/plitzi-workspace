import path from 'node:path';

import chalk from 'chalk';

import { endsWith, HELD_WORD } from '../../../runs/agents/held';
import { isPrincipal } from '../../../runs/agents/leads';
import { backupText } from '../../../runs/copies/strays';
import { runPaths } from '../../../runs/core/paths';
import { RunRefusal } from '../../../runs/core/refusal';
import { crossed, longFileText } from '../../../runs/plan/longFiles';
import { experienceFrom } from '../../../runs/report/experience';
import { logRun } from '../../../runs/run';
import { tellLead } from '../../../runs/talk/talk';
import {
  checkTask,
  completeResearch,
  completeTask,
  reportProgress,
  stopAfterPiece,
  unblockTask
} from '../../../runs/tasks';
import { broughtText } from '../../../runs/tasks/common';
import { act, holder, inHand, runOf } from '../shell';
import { hhmm, list, messageLines, pieceEnd, reusedServerText, secondRunText, slowLineText } from '../text';

import type { ExperienceFlags } from '../../../runs/report/experience';
import type { RunCommandOptions } from '../shell';

/**
 * A task at work: its progress, a block and its answer, a note, and its completion.
 */

export const taskProgress = (options: RunCommandOptions & { fraction?: number; step?: string }): Promise<void> =>
  act(
    options,
    async ctx => {
      const runId = await runOf(ctx, options);
      // A review or a spike in hand gives its sign of life as a task's work does: noted on it, the lead sees where it
      // is. Only a task at work keeps its progress in its copy's record — its locks live by it.
      const held = await inHand(ctx, runId);
      if (held !== undefined && held.kind !== 'work') {
        await logRun(ctx, runPaths(ctx.root, runId), {
          action: 'progress',
          task: held.task,
          kind: held.kind,
          ...(options.fraction !== undefined ? { fraction: options.fraction } : {}),
          ...(options.step !== undefined ? { step: options.step } : {})
        });

        return { held };
      }

      const { taskId } = await holder(ctx, options);

      return reportProgress(ctx, runId, taskId, {
        ...(options.fraction !== undefined ? { fraction: options.fraction } : {}),
        ...(options.step !== undefined ? { step: options.step } : {})
      });
    },
    signal =>
      'held' in signal
        ? `Noted on your ${HELD_WORD[signal.held.kind]} of ${signal.held.task}: the lead sees where you are. It ends with ${endsWith(signal.held)}`
        : [
            ...signal.longFiles.map(long =>
              chalk.yellow(
                `  ⚠ ${longFileText(long)}: split it by what changes together — a section or a part per file${crossed(long) ? '; complete refuses it past the line' : ''}`
              )
            ),
            signal.inReview
              ? `${signal.task} is in review: no sign of life is needed until it comes back to you — and what you write in its copy now is not reviewed. Take another task meanwhile: plitzi task next`
              : `${signal.task}: a sign of life at ${hhmm(signal.at)}. Without another, the lead may reassign it after ${hhmm(signal.quietAfter)}, and another agent take it after ${hhmm(signal.takenAfter)}.`,
            ...messageLines(signal.messages)
          ].join('\n')
  );

export const taskUnblock = (taskId: string, options: RunCommandOptions & { answer?: string }): Promise<void> =>
  act(
    options,
    async ctx => unblockTask(ctx, await runOf(ctx, options), taskId, options.answer),
    state => `${taskId} is ${state.status} again.`
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
        ...(checked.brought ? [`Brought into your copy first, ${broughtText(checked.brought)}`] : []),
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
        ...(checked.failedAlikeAt
          ? [
              chalk.yellow(
                `  The same as at ${checked.failedAlikeAt.slice(11, 16)} UTC, on the same files: nothing changed since, so it fails the same — change what it says, then check (a check run again on the same files answers the same)`
              )
            ]
          : []),
        ...checked.checks.steps.map(step =>
          step.ok
            ? `  ✓ ${step.name}`
            : checked.notOwn?.includes(step.name) === true
              ? chalk.dim(`  · ${step.name} — fails in the run's work too: the run's, not yours`)
              : `  ${chalk.yellow('✗')} ${step.name}\n${(step.said ?? []).map(line => `      ${line}`).join('\n')}`
        ),
        // A run's dev-1 read check's warnings in files it never touched as its own; complete said them apart already.
        ...warningLines(checked.checks.steps, checked.changed),
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
            `  ${each.ok ? '✓' : chalk.yellow('✗')} acceptance — ${each.said}  ${chalk.dim(`[${each.check}]`)}${secondRunText(each)}${slowLineText(each)}${reusedServerText(each)}${each.ok || !each.output ? '' : `\n${each.output.map(line => `      ${line}`).join('\n')}`}`
        ),
        ...checked.tooLong.map(each => chalk.yellow(`  ✗ ${each}`)),
        ...(checked.backups ?? []).map(file => chalk.yellow(`  ✗ ${backupText(file)}`)),
        ...(checked.othersFiles ?? []).map(each =>
          chalk.yellow(
            `  ✗ ${each.file} is ${each.holder}'s, at work — complete refuses it: put it back (plitzi task discard ${each.file}) and propose the change to ${each.holder} (plitzi task propose ${each.holder} --change "…"), or wait for it (plitzi task claim ${each.file} --wait)`
          )
        ),
        ...(checked.notOwn
          ? [
              chalk.dim(
                `  Not your work, and not counted against you: ${checked.notOwn.join('; ')} — the run's work fails it too, or nothing could answer the line (the lead is told). Complete takes it as the run's: no --known-failure for it`
              )
            ]
          : []),
        ...messageLines(checked.messages)
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
    // said so, not as something to fix (design-1 read the two as contradicting each other).
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
  named: string | undefined,
  options: RunCommandOptions & {
    knownFailure?: string;
    fixedBy?: string;
    note?: string;
  } & ExperienceFlags
): Promise<void> =>
  act(
    options,
    async ctx => {
      // Asked first: a forgotten flag is said before anything runs, and costs no check.
      const experience = experienceFrom(options, 'task complete');
      const { runId, taskId } = await holder(ctx, options);
      // Named, it is said back: the lead's `task complete t-x` was refused as an argument too many.
      if (named !== undefined && named !== taskId) {
        throw new RunRefusal(
          'invalid',
          `You hold ${taskId}, not ${named}: complete it in its copy — plitzi task complete`
        );
      }

      if (options.fixedBy && !options.knownFailure) {
        throw new RunRefusal('invalid', '--fixed-by goes with --known-failure "why": the task that fixes what fails');
      }

      const completed = await completeTask(ctx, runId, taskId, {
        experience,
        ...(options.knownFailure
          ? { knownFailure: { why: options.knownFailure, ...(options.fixedBy ? { fixedBy: options.fixedBy } : {}) } }
          : {})
      });
      // Told once it is in review, never for a completion refused: the note goes with the work it is about.
      if (options.note !== undefined && options.note.trim() !== '') {
        await tellLead(ctx, runId, taskId, options.note);
      }

      const stop = await stopAfterPiece(ctx, runId);

      return { ...completed, ...(stop === undefined ? {} : { stop }) };
    },
    completed =>
      [
        `In review: ${String(completed.changed.length)} files changed (${list(completed.changed)}).`,
        ...(completed.claimed.length > 0
          ? [`  Taken by turns as it completed, free: ${completed.claimed.join(', ')} — they go into the run with it`]
          : []),
        ...(completed.merged.length > 0
          ? [`  Put together with the run's newer version, line by line: ${completed.merged.join(', ')}`]
          : []),
        ...(completed.brought.length > 0
          ? [`  Brought into your copy before the checks, ${broughtText(completed.brought)}`]
          : []),
        ...(completed.requests.length > 0
          ? [`  Requests on shared files: ${completed.requests.map(each => each.file).join(', ')}`]
          : []),
        completed.checks.none
          ? chalk.yellow(`  Not checked: ${completed.checks.none}`)
          : completed.checks.ok
            ? `  Checks passed: ${list(completed.checks.steps.map(step => step.name))}${completed.checkedAt ? ` — as task check passed them at ${completed.checkedAt.slice(11, 16)} UTC, nothing changed since: not run again` : ''}`
            : chalk.yellow(
                // Said as what it is: one with no --known-failure is the run's, not "as you said" (a run's design-2).
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
        chalk.dim(`  Round ${String(completed.report.round)}'s report kept for the run's, with what it was like`),
        ...pieceEnd(
          completed.stop,
          '  Nothing more on it until its review comes back: plitzi task next hands you what is next — a task you hold first.'
        ),
        ...messageLines(completed.messages)
      ].join('\n')
  );

/**
 * `plitzi task complete --found "…" [--tasks <stage.json>]`: what a research card found, and the tasks it makes — its
 * scout's in its copy, to the lead's review; the lead's own, named, done at once.
 */
export const taskFound = (
  named: string | undefined,
  options: RunCommandOptions & { found?: string; tasks?: string; closes?: string }
): Promise<void> =>
  act(
    options,
    async ctx => {
      if (options.found === undefined) {
        throw new RunRefusal('invalid', '--tasks goes with --found "…": the tasks what a research card found makes');
      }

      const own = ctx.token === undefined && isPrincipal(ctx.agent);
      const { runId, taskId } = own ? { runId: await runOf(ctx, options), taskId: named } : await holder(ctx, options);
      if (taskId === undefined) {
        throw new RunRefusal('invalid', 'Name the research card: plitzi task complete s-scope --found "…"');
      }

      if (named !== undefined && named !== taskId) {
        throw new RunRefusal(
          'invalid',
          `You hold ${taskId}, not ${named}: complete it in its copy — plitzi task complete --found "…"`
        );
      }

      const tasks = options.tasks === undefined ? {} : { tasks: path.resolve(options.tasks) };
      const closes = (options.closes ?? '')
        .split(',')
        .map(id => id.trim())
        .filter(id => id !== '');

      const found = await completeResearch(ctx, runId, taskId, options.found, { ...tasks, closes });
      const stop = own ? undefined : await stopAfterPiece(ctx, runId);

      return { ...found, ...(stop === undefined ? {} : { stop }) };
    },
    found =>
      found.status === 'in-review'
        ? [
            `What you found on ${found.task} goes to the lead, who decides it${found.proposed && found.proposed.length > 0 ? ` with the person: ${found.proposed.join(', ')}` : ''} — nothing is stacked until it approves; what it asks comes with your next command.`,
            ...(found.notices ?? []).map(notice => `  · ${notice}`),
            ...(found.stop === undefined ? [] : pieceEnd(found.stop, ''))
          ].join('\n')
        : [
            `${found.task} is done: its findings go with every task that waits for it.${found.added ? ` It made ${found.added.join(', ')}${found.stage === undefined ? '' : ` — their plan, to amend them from: ${found.stage}`}.` : ''}${found.ready && found.ready.length > 0 ? ` Ready now: ${found.ready.join(', ')}.` : ''}`,
            ...(found.notices ?? []).map(notice => `  · ${notice}`)
          ].join('\n')
  );
