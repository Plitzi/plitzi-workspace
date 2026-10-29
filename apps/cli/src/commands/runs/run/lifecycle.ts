import chalk from 'chalk';

import { ensureKeeper, keeperText } from '../../../runs/agents/keeper';
import { ownServer } from '../../../runs/copies/acceptance';
import { continueRun, finishRun, resolveFile, restoreFile } from '../../../runs/copies/merge';
import { RunRefusal } from '../../../runs/core/refusal';
import { FINDING_OWNERS } from '../../../runs/findings';
import { BACKLOG_FILE } from '../../../runs/plan/backlog';
import { attachRun, releaseRun, resumeRun, stopRun } from '../../../runs/run';
import { abortRun } from '../../../runs/run/abort';
import { canWrite } from '../../../runs/tasks';
import { projectRun } from '../../../scaffold/packageManager';
import { KV_FILE } from '../../../scaffold/paths';
import { act, runOf, taskOf } from '../shell';
import { inputLines, list, secondRunText } from '../text';

import type { Finding } from '../../../runs/findings';
import type { LeftReport } from '../../../runs/report/leaveReport';
import type { RunCommandOptions } from '../shell';

/**
 * A run stopped, resumed, finished into the project — or not — attached, released, purged.
 */

/** Where the run's reports are, said with what to do with them: the person's to commit and share, never sent by itself. */
const reportLines = (left: LeftReport): string[] => [
  `The run's reports: ${left.dir} — feedback.md (what of it is Plitzi's, read first), report.md (the run whole), report.json, records/ (what the run kept: ${String(left.records.files)} files, ${String(Math.ceil(left.records.bytes / 1024))} KB)${left.scratch.kept.length > 0 ? `, scratch/ (the agents' ${String(left.scratch.kept.length)} script${left.scratch.kept.length === 1 ? '' : 's'})` : ''}`,
  ...(left.scratch.tooLarge.length > 0
    ? [`  Scripts left out as too large to be an agent's: ${list(left.scratch.tooLarge)}`]
    : []),
  "  No path of this machine and no token in them: commit them with the project, and send the folder to Plitzi's team to make Plitzi better"
];

/** How many of each whose come first in a finish's answer: the whole list is the report's. */
const SHOWN_A_OWNER = 5;

/** What the run shows went wrong, as the finish says it: a few of each whose — every one, with its evidence, in the report. */
const findingsLines = (findings: readonly Finding[]): string[] => {
  if (findings.length === 0) {
    return ['  The run’s records show nothing out of place'];
  }

  const counts = FINDING_OWNERS.flatMap(owner => {
    const theirs = findings.filter(finding => finding.owner === owner).length;

    return theirs > 0 ? [`${owner} ${String(theirs)}`] : [];
  });

  return [
    chalk.yellow(
      `  What the run shows went wrong (${counts.join(', ')}) — each with its evidence and fix in the report: plitzi run report`
    ),
    ...FINDING_OWNERS.flatMap(owner => {
      const theirs = findings.filter(finding => finding.owner === owner);

      return [
        ...theirs
          .slice(0, SHOWN_A_OWNER)
          .map(finding =>
            chalk.yellow(`    - ${owner}: ${finding.title}${finding.times > 1 ? ` ×${String(finding.times)}` : ''}`)
          ),
        ...(theirs.length > SHOWN_A_OWNER
          ? [chalk.yellow(`    - ${owner}: … ${String(theirs.length - SHOWN_A_OWNER)} more`)]
          : [])
      ];
    })
  ];
};

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
    async ctx => {
      const id = await runOf(ctx, options, runId);
      await resumeRun(ctx, id);

      return { keeper: await ensureKeeper(ctx, id) };
    },
    resumed => `Open again: tasks can be taken.\n${keeperText(resumed.keeper)}`
  );

export interface FinishOptions extends RunCommandOptions {
  apply?: boolean;
  leavePending?: boolean;
  keepBackup?: boolean;
}

export const runFinish = (runId: string | undefined, options: FinishOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const finished = await finishRun(ctx, await runOf(ctx, options, runId), {
        apply: options.apply ?? false,
        leavePending: options.leavePending ?? false,
        backup: options.keepBackup ?? false
      });
      // A server of the project still up serves it as it was and holds its state: the person's next `npm start` fails
      // on its lock (state/kv.json held by the lead's own server, stopped by port and not yet gone).
      const running = finished.dryRun ? undefined : await ownServer(ctx.root);

      return { ...finished, ...(running === undefined ? {} : { running }) };
    },
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
        ...findingsLines(finished.findings),
        ...(finished.noticed.length > 0
          ? [
              '  Noticed during the run, owned by no task — what a stage of its own takes (plitzi run open <stage>):',
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
        finished.dryRun && finished.notLooked
          ? chalk.yellow(
              'Next, the lead: one look at the whole result since its last approval — plitzi run look — --apply refuses until then'
            )
          : finished.dryRun && finished.noReport
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
                    : 'A person writes it: plitzi run finish --apply (--keep-backup keeps the files it overwrites) — or lets the lead, once: plitzi run finish --lead-finishes'
                : [
                    finished.backup
                      ? `The files as they were before it: ${finished.backup} (copy one back to undo it)`
                      : 'No backup was kept: --keep-backup keeps one next time.',
                    `Written by ${String(finished.writtenBy)}.`,
                    ...(finished.report ? reportLines(finished.report) : []),
                    ...(finished.running === undefined
                      ? []
                      : [
                          chalk.yellow(
                            `A server of the project is still running on :${String(finished.running)}: it serves the project as it was and holds its state (${KV_FILE}) — stop it before ${projectRun('start')}: plitzi server stop --port ${String(finished.running)}`
                          )
                        ]),
                    ...(finished.backlog
                      ? [
                          `What it noticed and left, kept for the next run in ${BACKLOG_FILE}: ${finished.backlog.join(', ')} (plitzi run backlog)`
                        ]
                      : []),
                    ...(finished.leadCli
                      ? [
                          `What the lead finds reading the report after this goes into it, never written in by hand: ${finished.leadCli.cli} run notice --run ${finished.leadCli.run} --plitzi <wrong|no-way|in-the-way> "…"`
                        ]
                      : []),
                    ...(finished.closedBacklog
                      ? [
                          `Of the backlog, what its tasks did, closed: ${finished.closedBacklog.join(', ')} (plitzi run backlog --all)`
                        ]
                      : []),
                    ...inputLines(finished.inputs)
                  ].join('\n')
      ].join('\n')
  );

export const runResolve = (
  runId: string,
  file: string,
  options: RunCommandOptions & { take?: string }
): Promise<void> =>
  act(
    options,
    ctx => {
      if (options.take === undefined) {
        throw new RunRefusal(
          'invalid',
          `${file} is settled with the version to keep: --take project|run|merge|<file>`,
          {
            next: `plitzi run resolve ${runId} ${file} --take run`
          }
        );
      }

      return resolveFile(ctx, runId, file, options.take);
    },
    resolved =>
      `${resolved.file}: resolved with ${resolved.resolved ?? ''}. Once every file is: plitzi run resolve ${runId} — the run goes on`
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
        `Aborted and removed, with its backups: nothing was written into the project. Discarded: ${list(aborted.discarded)}`,
        ...('problem' in aborted.report
          ? [`  No report was left: ${aborted.report.problem}`]
          : reportLines(aborted.report)),
        ...(aborted.leadCli
          ? [
              `  What the lead finds reading it goes into it, never written in by hand: ${aborted.leadCli.cli} run notice --run ${aborted.leadCli.run} --plitzi <wrong|no-way|in-the-way> "…"`
            ]
          : []),
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
      `${restored.file} put back (${restored.merge}); undo it: plitzi run show ${runId} ${restored.file} --restore ${restored.merge}`
  );

export const runAttach = (runId: string, options: RunCommandOptions & { takeOver?: boolean }): Promise<void> =>
  act(
    options,
    async ctx => {
      const id = await runOf(ctx, options, runId);
      const attached = await attachRun(ctx, id, options.takeOver ?? false);

      return { ...attached, keeper: await ensureKeeper(ctx, id) };
    },
    attached =>
      `Attached to "${runId}"${attached.tookOver ? ', taken over from the other machine' : ''}${attached.repinned ? ', re-pinned to the Plitzi installed now' : ''}. Cut: ${list(attached.cut)}.${attached.kept.length > 0 ? ` Kept in their agents' hands, told to go on: ${attached.kept.join(', ')}.` : ''}\n${keeperText(attached.keeper)}\nGo on: plitzi run status ${runId}`
  );

/** `plitzi run attach <run> --release`: the run let go from this machine — the other way of attaching to it. */
export const runRelease = (runId: string, options: RunCommandOptions & { takeOver?: boolean }): Promise<void> =>
  act(
    options,
    async ctx => {
      if (options.takeOver) {
        throw new RunRefusal('invalid', 'A run is taken over or let go, not both: --take-over or --release');
      }

      return releaseRun(ctx, await runOf(ctx, options, runId));
    },
    () => `Released: another machine can attach to "${runId}".`
  );
