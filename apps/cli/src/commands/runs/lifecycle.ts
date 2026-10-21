import chalk from 'chalk';

import { act, runOf, taskOf } from './shell';
import { inputLines, list, secondRunText } from './text';
import { BACKLOG_FILE } from '../../runs/backlog';
import { abortRun, continueRun, finishRun, resolveFile, restoreFile } from '../../runs/merge';
import { RunRefusal } from '../../runs/refusal';
import { attachRun, pruneRuns, purgeRun, releaseRun, resumeRun, stopRun } from '../../runs/run';
import { canWrite } from '../../runs/tasks';

import type { RunCommandOptions } from './shell';

/**
 * A run stopped, resumed, finished into the project — or not — attached, released, purged.
 */

export const runCanWrite = (file: string, options: RunCommandOptions & { task?: string }): Promise<void> =>
  act(
    options,
    async ctx => {
      const task = ctx.token ? taskOf(ctx) : options.task;
      const answer = await canWrite(ctx, file, task);
      if (!answer.ok && 'plannedFor' in answer) {
        throw new RunRefusal(
          'claimed',
          `${answer.file} is task "${answer.plannedFor.task}"'s (run "${answer.plannedFor.run}"), not taken yet: its agent writes it — propose your change to it (plitzi task propose ${answer.plannedFor.task} --change "…")`,
          { file: answer.file, task: answer.plannedFor.task }
        );
      }

      if (!answer.ok) {
        throw new RunRefusal(
          'claimed',
          `${answer.file} is task "${answer.holder.task}"'s (run "${answer.holder.run}", ${answer.holder.lock.agent}: ${answer.holder.lock.intent})${answer.holder.until ? `; if it gives no sign of life, its lock runs out at ${answer.holder.until}` : ''}`,
          {
            file: answer.file,
            task: answer.holder.task,
            holder: answer.holder.lock.agent,
            ...(answer.holder.until ? { until: answer.holder.until } : {})
          }
        );
      }

      return answer;
    },
    answer =>
      answer.plannedFor
        ? `Yes: no task holds ${answer.file} now — task "${answer.plannedFor.task}" (run "${answer.plannedFor.run}") takes it when it starts, from the project as it is then.`
        : `Yes: ${answer.file} is not held by another task.`
  );

export const runStop = (runId: string | undefined, options: RunCommandOptions & { force?: boolean }): Promise<void> =>
  act(
    options,
    async ctx => stopRun(ctx, await runOf(ctx, options, runId), options.force ?? false),
    stopped =>
      options.force
        ? `Stopped now. Cut: ${list(stopped.cut)} — each starts again from its last reviewed version, or from scratch if it never had one; what their agents started in the copies (their servers) is theirs to stop.`
        : 'Stopping: the tasks in hand finish and go to review; none starts. What is pending stays in the plan.'
  );

export const runResume = (runId: string | undefined, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => resumeRun(ctx, await runOf(ctx, options, runId)),
    () => 'Open again: tasks can be taken.'
  );

export interface FinishOptions extends RunCommandOptions {
  apply?: boolean;
  leavePending?: boolean;
  keepBackup?: boolean;
}

export const runFinish = (runId: string | undefined, options: FinishOptions): Promise<void> =>
  act(
    options,
    async ctx =>
      finishRun(ctx, await runOf(ctx, options, runId), {
        apply: options.apply ?? false,
        leavePending: options.leavePending ?? false,
        backup: options.keepBackup ?? false
      }),
    finished =>
      [
        chalk.bold(
          finished.dryRun
            ? 'The run into the project — dry run, nothing written:'
            : 'Written into the project, and the run removed:'
        ),
        ...finished.plan.apply.map(
          each => `  ${each.before === null ? '+' : each.after === null ? '-' : '~'} ${each.file}`
        ),
        ...(finished.plan.same.length > 0 ? [`  already as the run has them: ${finished.plan.same.join(', ')}`] : []),
        ...finished.plan.conflicts.map(each => chalk.yellow(`  ! ${each.file}: changed in the project and in the run`)),
        ...finished.plan.overwrites.map(each =>
          chalk.yellow(
            `  ⚠ ${each.file}: written over a change made outside the run — ${each.task}'s version, decided by ${each.by}; the other is kept`
          )
        ),
        finished.plan.checks?.none
          ? chalk.yellow(`  Not checked: ${finished.plan.checks.none}`)
          : `  The project's checks pass on the result (${list(finished.plan.checks?.steps.map(step => step.name) ?? [])})${
              finished.plan.checks?.reused
                ? ` — as they did at ${finished.plan.checks.reused.slice(11, 16)} UTC on this same result, not run again`
                : ''
            }`,
        ...((finished.plan.acceptance?.results.length ?? 0) > 0
          ? [
              `  Every done task's acceptance checks hold on the result too (${String(finished.plan.acceptance?.results.length ?? 0)})${finished.plan.acceptance?.reused ? ' — as on this same result before, not run again' : finished.plan.acceptance?.kept ? ` — ${String(finished.plan.acceptance.kept)} as on this same result before, the rest run again` : ''}`
            ]
          : []),
        ...(finished.plan.acceptance?.results ?? [])
          .filter(each => each.firstFailed)
          .map(each => `    ${each.task}: ${each.said}${secondRunText(each)}`),
        ...(finished.left.length > 0 ? [`  Left in the plan: ${finished.left.join(', ')}`] : []),
        ...(finished.audit.length > 0
          ? [
              chalk.yellow('  What the run’s activity shows (kept in its report — the CLI’s to fix, or the team’s):'),
              ...finished.audit.map(each => chalk.yellow(`    - ${each}`))
            ]
          : ['  The run’s activity shows nothing out of place']),
        ...(finished.noticed.length > 0
          ? [
              '  Noticed during the run, owned by no task — what a stage of its own takes (plitzi run extend):',
              ...finished.noticed.map(each => `    - ${each}`)
            ]
          : []),
        ...(finished.leftInTmp
          ? [
              chalk.yellow(
                `  Left in the project's tmp/ during the run, by nobody's tool: ${finished.leftInTmp.join(', ')} — an agent's, most likely; the run does not remove the person's tmp/: remove what nobody needs`
              )
            ]
          : []),
        ...(finished.summaryBehind
          ? [
              chalk.yellow(
                `  ⚠ The lead's summary was written before ${list(finished.summaryBehind)} ${finished.summaryBehind.length === 1 ? 'was' : 'were'} approved: it says nothing of them, or says it wrong`
              )
            ]
          : []),
        finished.dryRun && finished.noReport
          ? chalk.yellow(
              'Next, the lead: the run’s report — what it did, what went wrong, what is left (plitzi run report --summary <file>) — --apply refuses until then'
            )
          : finished.dryRun && finished.summaryBehind
            ? 'Next, the lead: the summary again, saying all of the run (plitzi run report --summary <file>) — --apply refuses until then'
            : finished.dryRun
              ? finished.plan.conflicts.length > 0
                ? 'With --apply the run enters reconciliation: a person resolves each conflict.'
                : finished.leadFinishes
                  ? 'A person let the lead write it: plitzi run finish --apply (--keep-backup keeps the files it overwrites)'
                  : 'A person writes it: plitzi run finish --apply (--keep-backup keeps the files it overwrites) — or lets the lead, once: plitzi run allow-finish'
              : [
                  finished.backup
                    ? `The files as they were before it: ${finished.backup} (copy one back to undo it)`
                    : 'No backup was kept: --keep-backup keeps one next time.',
                  `Written by ${String(finished.writtenBy)}. The run's report: ${String(finished.report)}`,
                  ...(finished.backlog
                    ? [
                        `What it noticed and left, kept for the next run in ${BACKLOG_FILE}: ${finished.backlog.join(', ')} (plitzi run backlog)`
                      ]
                    : []),
                  ...inputLines(finished.inputs)
                ].join('\n')
      ].join('\n')
  );

export const runResolve = (runId: string, file: string, options: RunCommandOptions & { take: string }): Promise<void> =>
  act(
    options,
    ctx => resolveFile(ctx, runId, file, options.take),
    resolved =>
      `${resolved.file}: resolved with ${resolved.resolved ?? ''}. Continue when every file is: plitzi run continue ${runId}`
  );

export const runContinue = (runId: string | undefined, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => continueRun(ctx, await runOf(ctx, options, runId)),
    () => 'Reconciliation resolved: the run goes on. The next finish checks the project again.'
  );

export const runAbort = (runId: string | undefined, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => abortRun(ctx, await runOf(ctx, options, runId)),
    aborted =>
      [
        `Aborted and removed: nothing was written into the project. Discarded: ${list(aborted.discarded)}`,
        `The run's report: ${aborted.report}`,
        ...inputLines(aborted.inputs)
      ].join('\n')
  );

export const runRestore = (
  runId: string,
  file: string,
  options: RunCommandOptions & { from?: string }
): Promise<void> =>
  act(
    options,
    ctx => restoreFile(ctx, runId, file, options.from ?? 'base'),
    restored =>
      `${restored.file} put back (${restored.merge}); undo it: plitzi run restore ${runId} ${restored.file} --from ${restored.merge}`
  );

export const runAttach = (runId: string, options: RunCommandOptions & { takeOver?: boolean }): Promise<void> =>
  act(
    options,
    ctx => attachRun(ctx, runId, options.takeOver ?? false),
    attached =>
      `Attached to "${runId}"${attached.tookOver ? ', taken over from the other machine' : ''}${attached.repinned ? ', re-pinned to the Plitzi installed now' : ''}. Cut: ${list(attached.cut)}.${attached.kept.length > 0 ? ` Kept in their agents' hands, told to go on: ${attached.kept.join(', ')}.` : ''}\nGo on: plitzi run status ${runId}`
  );

export const runRelease = (runId: string, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    ctx => releaseRun(ctx, runId),
    () => `Released: another machine can attach to "${runId}".`
  );

export const runPurge = (runId: string, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    ctx => purgeRun(ctx, runId),
    inputs => [`Run "${runId}" removed, with its backups.`, ...inputLines(inputs)].join('\n')
  );

export const runPrune = (options: RunCommandOptions): Promise<void> =>
  act(
    options,
    ctx => pruneRuns(ctx),
    pruned =>
      pruned.length === 0
        ? 'No cache to prune.'
        : pruned.map(each => `${each.run}: ${(each.freed / 1e6).toFixed(1)} MB freed (${each.why})`).join('\n')
  );
