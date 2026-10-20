import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';

import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { findProject } from './existingProject';
import { proposalsOf } from '../runs/agreements';
import { projectChecks } from '../runs/checks';
import { waitForLead } from '../runs/leadWatch';
import { abortRun, continueRun, finishRun, resolveFile, restoreFile, showVersion } from '../runs/merge';
import { expandFiles, impactOf, readOwnership } from '../runs/ownership';
import { RUNS_DIR, runPaths, taskPaths } from '../runs/paths';
import { DEFAULT_AGENTS } from '../runs/plan';
import { startPreview, startTaskPreview } from '../runs/preview';
import { answerProposal, proposeChange } from '../runs/proposals';
import { isRunRefusal, RunRefusal } from '../runs/refusal';
import { buildReport, readSummary, reportText, writeSummary } from '../runs/report';
import {
  activeRuns,
  attachRun,
  loadRun,
  checkPlanFile,
  openRun,
  pruneRuns,
  purgeRun,
  releaseRun,
  resumeRun,
  stopRun
} from '../runs/run';
import { showTask } from '../runs/show';
import { askLead, messageTasks, readInbox } from '../runs/talk';
import {
  blockTask,
  canWrite,
  claimFile,
  claims,
  completeTask,
  discardFile,
  nextTask,
  noteTask,
  reassignTask,
  releaseFile,
  reportProgress,
  requestShared,
  revertTask,
  reviewTask,
  followNext,
  followWait,
  takeTask,
  taskContext,
  unblockTask,
  waitForFile
} from '../runs/tasks';
import { readOwner } from '../runs/taskStore';
import { runsState, runText, viewRun } from '../runs/view';
import { CLI_VERSION } from '../scaffold/project';

import type { CheckStep } from '../runs/checks';
import type { Message } from '../runs/messages';
import type { Needs } from '../runs/model';
import type { RemovedInputs, RunContext } from '../runs/run';

/**
 * `plitzi run` and `plitzi task` (RFC 0028): several agents on one project, each in a copy of it, merged once by a
 * person. Every command answers `--json` for a harness and leaves a distinct exit code per refusal (`runs/refusal.ts`);
 * a person's command asks them to type the run's name in their own terminal, and is refused anywhere else.
 */

export interface RunCommandOptions {
  json?: boolean;
  /** The task's token `plitzi task take` answered; `PLITZI_TASK_TOKEN` otherwise. */
  token?: string;
  /** Who is calling, for the log: an agent's name. `PLITZI_AGENT` otherwise. */
  agent?: string;
  /** The run, when the token does not say it and the project has more than one. `PLITZI_RUN` otherwise. */
  run?: string;
}

/** A task's token says its run and its task: `<run>.<task>.<secret>`, so a task's commands need nothing else. */
const TOKEN = /^([a-z0-9][a-z0-9_-]*)\.([a-z0-9][a-z0-9_-]*)\.([0-9a-f]{48})$/;

const tokenOf = (options: RunCommandOptions): string | undefined => options.token ?? process.env.PLITZI_TASK_TOKEN;

/**
 * The project the command works on: the one it is run in — and, run from inside a task's copy (which has a package.json
 * of its own), the project that copy belongs to.
 */
const projectRoot = async (): Promise<string> => {
  const project = await findProject(process.cwd());
  if (!project) {
    throw new RunRefusal('not-found', 'There is no package.json here or above: run this in the project');
  }

  const marker = `${path.sep}${RUNS_DIR.split('/').join(path.sep)}${path.sep}`;
  const at = project.root.indexOf(marker);

  return at === -1 ? project.root : project.root.slice(0, at);
};

/** A person, at a terminal of their own, typing the run's name — never an agent's shell, which has none. */
const askPerson = async (runId: string, action: string): Promise<boolean> => {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false;
  }

  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await readline.question(`${chalk.bold(`To ${action}`)}, type the run's name (${runId}): `);

    return answer.trim() === runId;
  } catch {
    // The terminal closed while asking (Ctrl-D, the input ended): not confirmed — refused as such, never a crash.
    return false;
  } finally {
    readline.close();
  }
};

/** The name a task's token was taken under: what its commands are logged as, unless the caller names itself. */
const holderName = async (root: string, token: string): Promise<string | undefined> => {
  const [, runId, taskId] = TOKEN.exec(token) ?? [];
  if (!runId || !taskId) {
    return undefined;
  }

  const owner = await readOwner(taskPaths(runPaths(root, runId), taskId)).catch(() => undefined);

  return owner?.token === token ? owner.agent : undefined;
};

const contextFor = async (options: RunCommandOptions): Promise<RunContext> => {
  const token = tokenOf(options);
  const root = await projectRoot();
  const agent =
    options.agent ??
    process.env.PLITZI_AGENT ??
    (token ? ((await holderName(root, token)) ?? 'agent') : process.stdin.isTTY ? 'person' : 'lead');

  return {
    root,
    now: () => new Date(),
    machine: os.hostname(),
    cli: CLI_VERSION,
    ...(token ? { token } : {}),
    agent,
    person: askPerson,
    checks: projectChecks
  };
};

/** The run a command is about: the token's, the one named, or the project's only active run. */
const runOf = async (ctx: RunContext, options: RunCommandOptions, named?: string): Promise<string> => {
  const fromToken = ctx.token ? TOKEN.exec(ctx.token)?.[1] : undefined;
  const runId = named ?? options.run ?? fromToken ?? process.env.PLITZI_RUN;
  if (runId) {
    return runId;
  }

  const active = await activeRuns(ctx.root);
  if (active.length === 1) {
    return active[0];
  }

  throw new RunRefusal(
    'invalid',
    active.length === 0
      ? 'There is no open run in this project'
      : `Name the run (--run): ${active.join(', ')} are open`,
    { runs: active }
  );
};

/** The task a command is about: the token's, which a named one must match. */
const taskOf = (ctx: RunContext, named?: string): string => {
  const fromToken = ctx.token ? TOKEN.exec(ctx.token)?.[2] : undefined;
  if (ctx.token && !fromToken) {
    throw new RunRefusal('invalid', 'That is not a task token: plitzi task take answers one');
  }

  if (named && fromToken && named !== fromToken) {
    throw new RunRefusal('invalid', `The token is task "${fromToken}"'s, not "${named}"'s`);
  }

  const task = named ?? fromToken;
  if (!task) {
    throw new RunRefusal('invalid', 'Name the task, or pass its token (--token, or PLITZI_TASK_TOKEN)');
  }

  return task;
};

/** Runs a command: its answer printed as text or JSON, a refusal as what it is and what to do next, with its exit code. */
const act = async <T>(
  options: RunCommandOptions,
  work: (ctx: RunContext) => Promise<T>,
  text: (result: T) => string,
  exitCode = 0
): Promise<void> => {
  try {
    const ctx = await contextFor(options);
    const result = await work(ctx);
    console.log(options.json ? JSON.stringify(result) : text(result));
    if (exitCode !== 0) {
      process.exitCode = exitCode;
    }
  } catch (error) {
    if (!isRunRefusal(error)) {
      throw error;
    }

    if (options.json) {
      console.log(JSON.stringify(error.toJSON()));
    } else {
      console.error(`${chalk.red(`Refused (${error.code}):`)} ${error.message}\n  ${chalk.dim(`Next: ${error.next}`)}`);
      error.detail.problems?.forEach(problem => console.error(`  - ${problem}`));
      failedSteps(error.detail.steps).forEach(step => {
        console.error(`  ${chalk.red('✗')} ${step.name}`);
        step.said?.forEach(line => console.error(`    ${line}`));
      });
    }

    process.exitCode = error.exitCode;
  }
};

/** The checks a refusal names as failing, as the CLI wrote them into its detail. */
const failedSteps = (steps: unknown): CheckStep[] =>
  Array.isArray(steps)
    ? steps.filter((step): step is CheckStep => isRecord(step) && typeof step.name === 'string')
    : [];

/** What the lead said to a task, as the task's answer shows it: on top, so it is not missed. */
const messageLines = (messages: readonly Message[]): string[] =>
  messages.map(message => chalk.cyan(`  ✉ ${message.from} (${message.id}): ${message.text}`));

/** What the run removed with it that the lead had handed it — and what it kept, changed since. */
const inputLines = (inputs: RemovedInputs | undefined): string[] => [
  ...(inputs && inputs.removed.length > 0
    ? [`Removed with the run, as you handed them: ${inputs.removed.join(', ')}`]
    : []),
  ...(inputs && inputs.kept.length > 0 ? [`Kept — changed since the run read them: ${inputs.kept.join(', ')}`] : [])
];

/** A time as the run says one: hours and minutes, in UTC. */
const hhmm = (iso: string): string => `${iso.slice(11, 16)} UTC`;

const list = (items: readonly string[]): string => (items.length > 0 ? items.join(', ') : 'none');

export interface PlanOptions extends RunCommandOptions {
  agents?: number;
}

export const runPlan = (file: string, options: PlanOptions): Promise<void> =>
  act(
    options,
    ctx => checkPlanFile(ctx, path.resolve(file), options.agents ?? DEFAULT_AGENTS),
    checked =>
      [
        chalk.bold(`Plan "${checked.runId}": ${checked.goal}`),
        ...checked.tasks.map(
          task =>
            `  ${task.id} (${task.priority}, ${String(task.estimateMinutes)} min${task.dependsOn.length > 0 ? `, after ${task.dependsOn.join(', ')}` : ''}): ${task.files.join(', ')}`
        ),
        `Shared files these tasks reach — by turns or by request: ${list(checked.sharedReached)} (${String(checked.shared.length)} shared in the project: plitzi space overview)`,
        ...checked.notices.map(notice => `  · ${notice}`),
        `Estimate: ${String(checked.estimate.tasks)} tasks, ${String(checked.estimate.agents)} agents at once, about ${String(checked.estimate.wallMinutes)} min (critical path ${String(checked.estimate.criticalPathMinutes)}, all of it ${String(checked.estimate.totalMinutes)}), at least ${String(checked.estimate.reviewRounds)} reviews`,
        checked.estimate.needsConfirmation
          ? chalk.yellow(`A person confirms it when it opens: ${checked.estimate.why ?? ''}`)
          : 'Opens without confirmation.',
        `Open it: plitzi run open ${file}`
      ].join('\n')
  );

export const runOpen = (file: string, options: PlanOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const opened = await openRun(ctx, path.resolve(file), options.agents ?? DEFAULT_AGENTS);
      await pruneRuns(ctx);

      return {
        runId: opened.checked.runId,
        folder: opened.paths.dir,
        tasks: opened.checked.tasks.map(task => task.id),
        backedUp: opened.backedUp,
        estimate: opened.checked.estimate
      };
    },
    opened =>
      `Run "${opened.runId}" is open: ${String(opened.tasks.length)} tasks, ${String(opened.backedUp)} files backed up in ${opened.folder}.\nStart a task: plitzi task next --run ${opened.runId}`
  );

export const runState = (options: RunCommandOptions): Promise<void> =>
  act(
    options,
    ctx => runsState(ctx),
    runs =>
      runs.length === 0
        ? 'No runs in this project.'
        : runs
            .map(
              run =>
                `${run.runId}: ${run.status}, ${String(run.done)} of ${String(run.total)} tasks done${run.activeOn ? ` on ${run.activeOn}` : ', released'}${run.attention > 0 ? `, ${String(run.attention)} needing attention` : ''}`
            )
            .join('\n')
  );

export const runStatus = (runId: string | undefined, options: RunCommandOptions): Promise<void> =>
  act(options, async ctx => viewRun(ctx, await runOf(ctx, options, runId)), runText);

export interface WatchRunOptions extends RunCommandOptions {
  interval?: number;
  until?: 'lead';
  timeout?: number;
}

/** `plitzi run watch --until lead`: ends with what is new for the lead — what a lead waiting in the background runs. */
const watchForLead = (runId: string | undefined, options: WatchRunOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const news = await waitForLead(ctx, await runOf(ctx, options, runId), {
        timeoutMs: (options.timeout ?? 25) * 60_000,
        everyMs: Math.max(1, options.interval ?? 10) * 1000
      });
      const { view, ...rest } = news;

      return { ...rest, ...(view ? { status: view.status, done: view.done, total: view.total } : {}) };
    },
    news =>
      news.gone
        ? 'The run is gone: it finished, or a person aborted it.'
        : news.timedOut
          ? `Nothing new for the lead in ${String(options.timeout ?? 25)} minutes (${String(news.done)} of ${String(news.total)} done): watch again.`
          : [
              chalk.bold(`For the lead (${String(news.done)} of ${String(news.total)} done):`),
              ...news.fresh.map(item => `  ⚠ ${item.text}`)
            ].join('\n')
  );

/** `plitzi run watch`: the run as it goes, again whenever it changes — one JSON object a line with --json. */
export const runWatch = async (runId: string | undefined, options: WatchRunOptions): Promise<void> => {
  if (options.until === 'lead') {
    return watchForLead(runId, options);
  }

  const every = Math.max(1, options.interval ?? 2) * 1000;
  let last = '';
  let sweptAt = Date.now();
  for (;;) {
    let printed = '';
    try {
      const ctx = await contextFor(options);
      const view = await viewRun(ctx, await runOf(ctx, options, runId));
      printed = options.json ? JSON.stringify(view) : runText(view);
      if (Date.now() - sweptAt > 30 * 60_000) {
        await pruneRuns(ctx);
        sweptAt = Date.now();
      }
    } catch (error) {
      if (!isRunRefusal(error)) {
        throw error;
      }

      // A run that was there and is gone finished or was aborted: following it ends, as it did.
      if (error.code === 'not-found' && last !== '') {
        console.log(
          options.json ? JSON.stringify({ gone: true }) : 'The run is gone: it finished, or a person aborted it.'
        );

        return;
      }

      console.log(options.json ? JSON.stringify(error.toJSON()) : `${error.code}: ${error.message}`);
      process.exitCode = error.exitCode;

      return;
    }

    if (printed !== last) {
      console.log(options.json ? printed : `\n${new Date().toISOString().slice(11, 19)} UTC\n${printed}`);
      last = printed;
    }

    await new Promise(resolve => setTimeout(resolve, every));
  }
};

export const runCanWrite = (file: string, options: RunCommandOptions & { task?: string }): Promise<void> =>
  act(
    options,
    async ctx => {
      const task = ctx.token ? taskOf(ctx) : options.task;
      const answer = await canWrite(ctx, file, task);
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
    answer => `Yes: ${answer.file} is not held by another task.`
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
          : `  The project's checks pass on the result (${list(finished.plan.checks?.steps.map(step => step.name) ?? [])})`,
        ...(finished.left.length > 0 ? [`  Left in the plan: ${finished.left.join(', ')}`] : []),
        finished.dryRun
          ? finished.plan.conflicts.length > 0
            ? 'With --apply the run enters reconciliation: a person resolves each conflict.'
            : 'A person writes it: plitzi run finish --apply (--keep-backup keeps the files it overwrites)'
          : [
              finished.backup
                ? `The files as they were before it: ${finished.backup} (copy one back to undo it)`
                : 'No backup was kept: --keep-backup keeps one next time.',
              `The run's report: ${String(finished.report)}`,
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

export const runShow = async (
  runId: string,
  file: string,
  options: RunCommandOptions & { version?: 'run' | 'base' | 'project' }
): Promise<void> =>
  act(
    options,
    async ctx => {
      const bytes = await showVersion(ctx, runId, file, options.version ?? 'run');

      return { file, version: options.version ?? 'run', text: bytes?.toString('utf-8') ?? null };
    },
    shown => shown.text ?? `(${shown.file} does not exist in that version)`
  );

export const runAttach = (runId: string, options: RunCommandOptions & { takeOver?: boolean }): Promise<void> =>
  act(
    options,
    ctx => attachRun(ctx, runId, options.takeOver ?? false),
    attached =>
      `Attached to "${runId}"${attached.tookOver ? ', taken over from the other machine' : ''}${attached.repinned ? ', re-pinned to the Plitzi installed now' : ''}. Cut: ${list(attached.cut)}.\nGo on: plitzi run status ${runId}`
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

export const taskNext = (
  options: RunCommandOptions & { role?: string; follow?: boolean; timeout?: number }
): Promise<void> =>
  act(
    options,
    async ctx =>
      options.follow
        ? followNext(ctx, await runOf(ctx, options), options.role, { timeoutMs: (options.timeout ?? 30) * 60_000 })
        : nextTask(ctx, await runOf(ctx, options), options.role),
    next =>
      [
        ...messageLines(next.messages),
        next.task
          ? next.yours
            ? `Yours to go on with: ${next.task.id} — ${next.task.title} (${next.yours === 'changes-requested' ? 'changes requested' : 'unblocked'}). Your token is still good: plitzi task context ${next.task.id}`
            : `Next: ${next.task.id} — ${next.task.title} (${next.task.priority}, ${next.task.role ?? 'developer'}). Take it: plitzi task take ${next.task.id}`
          : String(next.why)
      ].join('\n')
  );

export const taskTake = (taskId: string, options: RunCommandOptions & { role?: string }): Promise<void> =>
  act(
    options,
    async ctx => {
      const runId = await runOf(ctx, options);
      const taken = await takeTask(ctx, runId, taskId, options.role);

      return { ...taken, run: runId, env: `PLITZI_TASK_TOKEN=${taken.token}` };
    },
    taken =>
      [
        chalk.bold(`Task "${taken.task.id}" is yours: ${taken.task.title}`),
        ...messageLines(taken.messages),
        ...taken.proposals.map(each =>
          chalk.cyan(`  ⇄ ${each.from} proposes (${each.id}): ${each.change} — plitzi task answer ${each.id}`)
        ),
        `  Write only in its copy: ${taken.work}`,
        `  Its files: ${taken.files.join(', ')}`,
        ...(taken.resumedFrom !== undefined
          ? [`  Resumed from the version review ${String(taken.resumedFrom)} saw`]
          : []),
        `  Its token — every command of the task carries it: --token ${taken.token}`,
        '  Done: plitzi task complete --token …'
      ].join('\n')
  );

/** The prelude every holder's command shares: the run and the task, from the token. */
const holder = async (ctx: RunContext, options: RunCommandOptions): Promise<{ runId: string; taskId: string }> => ({
  runId: await runOf(ctx, options),
  taskId: taskOf(ctx)
});

/** For a task's holder or the lead: the token's task, else the one named. */
const either = async (
  ctx: RunContext,
  options: RunCommandOptions,
  named?: string
): Promise<{ runId: string; taskId: string }> => ({ runId: await runOf(ctx, options), taskId: taskOf(ctx, named) });

export const taskClaims = (options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => claims(ctx, await runOf(ctx, options)),
    found =>
      found.length === 0
        ? 'No file is locked.'
        : found
            .map(
              each =>
                `${each.file}: ${each.lock.taskId} (${each.lock.agent}, ${each.lock.kind === 'turn' ? 'by turns' : 'its own'}) since ${each.lock.since}${each.live ? '' : ' — run out'}`
            )
            .join('\n')
  );

export const taskClaim = (file: string, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const { runId, taskId } = await holder(ctx, options);

      return claimFile(ctx, runId, taskId, file);
    },
    claimed =>
      `${claimed.file} is yours by turns: your copy keeps what you wrote in it (or takes the run's version if you had not touched it), and your change goes into the run when this task is approved.`
  );

export const taskRelease = (file: string, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const { runId, taskId } = await holder(ctx, options);

      return releaseFile(ctx, runId, taskId, file);
    },
    granted => `Let go.${granted.length > 0 ? ` Now: ${granted.join(', ')}` : ''}`
  );

export const taskWait = (
  file: string,
  options: RunCommandOptions & { follow?: boolean; timeout?: number }
): Promise<void> =>
  act(
    options,
    async ctx => {
      const { runId, taskId } = await holder(ctx, options);
      const waiting = await waitForFile(ctx, runId, taskId, file);
      if (!options.follow) {
        return { ...waiting, followed: undefined };
      }

      const followed = await followWait(ctx, runId, taskId, { timeoutMs: (options.timeout ?? 30) * 60_000 });
      if (!followed.done) {
        throw new RunRefusal(
          'waiting',
          `Still waiting for ${waiting.holder} on ${waiting.file} after ${String(options.timeout ?? 30)} min`,
          {
            file: waiting.file,
            holder: waiting.holder
          }
        );
      }

      return { ...waiting, followed };
    },
    waited =>
      waited.followed
        ? `${waited.file} is yours now. ${waited.followed.note ?? ''}`
        : `Waiting for ${waited.holder} on ${waited.file}: it comes to this task when ${waited.holder} is approved, with the run's version. Go on with what of your task does not need it; \`plitzi task wait ${waited.file} --follow\` waits until it is yours.`,
    options.follow ? 0 : 11
  );

export const taskDiscard = (file: string, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const { runId, taskId } = await holder(ctx, options);

      return { file, brought: await discardFile(ctx, runId, taskId, file) };
    },
    discarded =>
      `${discarded.file} in your copy is the run's version now, and your copy starts from it.${discarded.brought.filter(each => each !== discarded.file).length > 0 ? ` Also brought in, approved since your copy was made: ${discarded.brought.filter(each => each !== discarded.file).join(', ')}` : ''}`
  );

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
        `${signal.task}: a sign of life at ${hhmm(signal.at)}. Without another, the lead may reassign it after ${hhmm(signal.quietAfter)}, and another agent take it after ${hhmm(signal.takenAfter)}.`
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
      `${target.taskId} is blocked (${target.blocked.needs}): ${target.blocked.reason}. Take another ready task meanwhile; once it is unblocked, plitzi task next hands it back to you first.`
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

export const taskRequest = (
  file: string,
  options: RunCommandOptions & { summary: string; usedIn?: string; blocking?: boolean }
): Promise<void> =>
  act(
    options,
    async ctx => {
      const { runId, taskId } = await holder(ctx, options);

      return requestShared(ctx, runId, taskId, file, {
        summary: options.summary,
        usedIn: (options.usedIn ?? '')
          .split(',')
          .map(each => each.trim())
          .filter(Boolean),
        blocking: options.blocking ?? false
      });
    },
    requested =>
      requested.integration
        ? `Requested, blocking: ${requested.integration} makes it, and this task waits for it. Take another ready task meanwhile.`
        : `Requested: change it in your copy as you need it; one integration task applies every request on ${requested.request.file} together.`
  );

export const taskComplete = (options: RunCommandOptions & { knownFailure?: string; fixedBy?: string }): Promise<void> =>
  act(
    options,
    async ctx => {
      const { runId, taskId } = await holder(ctx, options);
      if (options.fixedBy && !options.knownFailure) {
        throw new RunRefusal('invalid', '--fixed-by goes with --known-failure "why": the task that fixes what fails');
      }

      return completeTask(ctx, runId, taskId, {
        ...(options.knownFailure
          ? { knownFailure: { why: options.knownFailure, ...(options.fixedBy ? { fixedBy: options.fixedBy } : {}) } }
          : {})
      });
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
        ...(completed.changedInProject.length > 0
          ? [
              chalk.yellow(
                `  Changed in the project meanwhile: ${completed.changedInProject.join(', ')} — the project's version wins at the merge`
              )
            ]
          : []),
        '  Take no other step on it until the review: plitzi task next for another.'
      ].join('\n')
  );

export interface ReviewOptions extends RunCommandOptions {
  approve?: boolean;
  /** Approve over a change made in the project while the task worked: its version wins, said and the other kept. */
  overwrite?: boolean;
  changes?: string;
  on?: string;
  file?: string;
}

export const taskReview = (taskId: string, options: ReviewOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      if (options.approve === (options.changes !== undefined)) {
        throw new RunRefusal('invalid', 'Review with --approve, or with --changes "what to change" — one of them');
      }

      return reviewTask(
        ctx,
        await runOf(ctx, options),
        taskId,
        options.approve ? 'approve' : 'changes',
        options.changes === undefined
          ? []
          : [
              {
                note: options.changes,
                ...(options.on ? { element: options.on } : {}),
                ...(options.file ? { file: options.file } : {})
              }
            ],
        options.overwrite ?? false
      );
    },
    reviewed =>
      reviewed.verdict === 'approve'
        ? [
            `${taskId} approved: ${list(reviewed.merged ?? [])} in the run's work.`,
            ...((reviewed.granted ?? []).length > 0 ? [`  Handed on: ${list(reviewed.granted ?? [])}`] : []),
            ...((reviewed.ready ?? []).length > 0 ? [`  Ready now: ${list(reviewed.ready ?? [])}`] : [])
          ].join('\n')
        : reviewed.toPerson
          ? `${taskId}: ${String(reviewed.round)} rounds of changes — it goes to a person.`
          : `${taskId}: changes requested (round ${String(reviewed.round)}); it goes back to the same task.`
  );

export const taskReassign = (taskId: string, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => reassignTask(ctx, await runOf(ctx, options), taskId),
    reassigned =>
      `${taskId} is ready again${reassigned.from ? `; ${reassigned.from}'s token is revoked` : ''}. ${
        reassigned.reviewedRound === undefined
          ? 'It was never reviewed: it starts from scratch.'
          : `It starts again from the version its review ${String(reassigned.reviewedRound)} saw.`
      } What its agent started in the copy — its own server — is not the CLI's to stop: stop it.`
  );

export const taskRevert = (taskId: string, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => revertTask(ctx, await runOf(ctx, options), taskId),
    reverted =>
      [
        `${taskId} reverted in the run's work: ${list(reverted.reverted)}.`,
        ...(reverted.kept.length > 0
          ? [`  Not reverted — another task changed them since: ${reverted.kept.join(', ')}`]
          : []),
        ...(reverted.dependants.length > 0 ? [`  Built on it: ${reverted.dependants.join(', ')} — check them`] : [])
      ].join('\n')
  );

export const taskShow = (taskId: string, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => showTask(ctx, await runOf(ctx, options), taskId),
    shown => {
      const { knownFailure } = typeof shown.checks === 'object' ? shown.checks : { knownFailure: undefined };

      return [
        chalk.bold(
          `${shown.task.id} — ${shown.task.title} · ${shown.status}${shown.round > 0 ? `, round ${String(shown.round)}` : ''}${shown.holder ? ` · ${shown.holder}` : ''}`
        ),
        `  ${shown.task.role ?? 'developer'} · its files: ${shown.task.files.join(', ')}`,
        ...(shown.task.acceptance.length > 0
          ? ['Acceptance', ...shown.task.acceptance.map(each => `  ☐ ${each}`)]
          : []),
        knownFailure
          ? chalk.yellow(
              `Checks: failing (${knownFailure.failing.join(', ')}) — ${knownFailure.why}${knownFailure.fixedBy ? `; ${knownFailure.fixedBy} fixes it` : ''}`
            )
          : `Checks: ${shown.checks === 'passed' ? 'passed at complete' : 'not run yet'}`,
        ...(shown.agreements.length > 0
          ? [
              'Agreed — check it holds',
              ...shown.agreements.map(each => `  ⇄ ${each.from} → ${each.to}: ${each.change}`)
            ]
          : []),
        ...shown.unanswered.map(each =>
          chalk.yellow(`  ⇄ unanswered ${each.id}: ${each.from} → ${each.to}: ${each.change}`)
        ),
        ...shown.requests.map(each => `  ↗ request on ${each.file}: ${each.summary}`),
        ...(shown.notes.length > 0 ? ['Notes', ...shown.notes.map(note => `  ${note.by}: ${note.text}`)] : []),
        ...(shown.messages.length > 0 ? ['Said', ...messageLines(shown.messages)] : []),
        `Changed (${shown.from === 'copy' ? 'its copy' : shown.from === 'run' ? 'as approved' : 'nothing yet'}): ${shown.files.length === 0 ? '—' : shown.files.map(each => `${each.file} (${each.change})`).join(', ')}`,
        ...shown.files.flatMap(each =>
          each.binary
            ? [`  ${each.file}: not text — not shown`]
            : [each.diff ?? '', ...(each.more ? [`  … ${String(each.more)} more lines`] : [])]
        ),
        ...(shown.next.length > 0 ? ['Next', ...shown.next.map(each => `  ${each}`)] : [])
      ].join('\n');
    }
  );

export const taskContextCommand = (taskId: string | undefined, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const target = await either(ctx, options, taskId);

      return taskContext(ctx, target.runId, target.taskId);
    },
    context => JSON.stringify(context, null, 2)
  );

export const spaceOverview = (options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const ownership = await readOwnership(ctx.root);

      return {
        entries: ownership.entries,
        units: ownership.units,
        shared: [...ownership.shared]
          .map(([file, reachedBy]) => ({ file, reachedBy, entry: ownership.entries.includes(file) }))
          .sort((a, b) => a.file.localeCompare(b.file)),
        missing: ownership.missing
      };
    },
    map =>
      [
        chalk.bold('Who owns which file, read off the imports'),
        ...map.units.map(
          unit =>
            `  ${unit.unit}: owns ${String(unit.owns.length)}${unit.reaches.length > 0 ? `, shares ${unit.reaches.join(', ')}` : ''}`
        ),
        chalk.bold('Shared — by turns or by request'),
        ...map.shared.map(
          shared =>
            `  ${shared.file} (${shared.entry ? 'an entry of the project' : `${String(shared.reachedBy.length)} units`})`
        ),
        ...(map.missing.length > 0
          ? [chalk.yellow('Imports of files that are not there:'), ...map.missing.map(each => `  ${each}`)]
          : [])
      ].join('\n')
  );

export const spaceImpact = (file: string, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const ownership = await readOwnership(ctx.root);
      const clean = file.replace(/\\/g, '/');

      return { file: clean, ...impactOf(ownership, clean), owns: expandFiles(ownership, [clean]) };
    },
    impact =>
      `${impact.file} — imported by ${String(impact.files.length)} files: ${list(impact.files)}\n  Units it touches: ${list(impact.units)}`
  );

export interface ProposeOptions extends RunCommandOptions {
  change: string;
  about?: string;
  why?: string;
  wait?: boolean;
  /** With `wait`: stay until the answer comes. */
  follow?: boolean;
}

export const taskPropose = (toTask: string, options: ProposeOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const { runId, taskId } = await holder(ctx, options);

      const proposed = await proposeChange(ctx, runId, taskId, toTask, {
        change: options.change,
        ...(options.about ? { about: options.about } : {}),
        ...(options.why ? { why: options.why } : {}),
        wait: (options.wait ?? false) || (options.follow ?? false)
      });

      return options.follow ? { ...proposed, followed: await followWait(ctx, runId, taskId) } : proposed;
    },
    proposed =>
      'followed' in proposed
        ? `${proposed.proposal.to} answered ${proposed.proposal.id}: ${proposed.followed.note ?? ''}`
        : proposed.waiting
          ? `Proposed to ${proposed.proposal.to} as ${proposed.proposal.id}; this task waits for the answer (--follow stays until it comes). Go on with what does not need it.`
          : `Proposed to ${proposed.proposal.to} as ${proposed.proposal.id}. Its answer comes in plitzi task proposals.`,
    0
  );

export interface AnswerOptions extends RunCommandOptions {
  accept?: boolean;
  reject?: string;
  counter?: string;
  note?: string;
}

export const taskAnswer = (proposal: string, options: AnswerOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const verdicts = [
        options.accept ? 'accept' : '',
        options.reject ? 'reject' : '',
        options.counter ? 'counter' : ''
      ].filter(Boolean);
      const [verdict] = verdicts;
      if (verdicts.length !== 1 || (verdict !== 'accept' && verdict !== 'reject' && verdict !== 'counter')) {
        throw new RunRefusal(
          'invalid',
          'Answer with one of --accept, --reject "why" or --counter "the change instead"'
        );
      }

      return answerProposal(ctx, await runOf(ctx, options), proposal, {
        verdict,
        ...(options.reject ? { note: options.reject } : options.note ? { note: options.note } : {}),
        ...(options.counter ? { counter: options.counter } : {})
      });
    },
    answered =>
      answered.counter
        ? `${answered.answer.proposal}: countered with ${answered.counter.id}, to ${answered.counter.to}.`
        : `${answered.answer.proposal}: ${answered.answer.verdict === 'accept' ? 'accepted — an agreement both tasks carry into review' : 'rejected'}.`
  );

export const taskProposals = (options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const all = await proposalsOf(await loadRun(ctx, await runOf(ctx, options), { anyVersion: true }));
      const mine = ctx.token ? taskOf(ctx) : undefined;

      return mine ? all.filter(each => each.to === mine || each.from === mine) : all;
    },
    all =>
      all.length === 0
        ? 'No proposals.'
        : all
            .map(
              each =>
                `${each.id} ${each.from} → ${each.to}: ${each.change}${each.about ? ` (${each.about})` : ''} — ${each.answer ? `${each.answer.verdict}${each.answer.note ? `: ${each.answer.note}` : ''}` : 'unanswered'}`
            )
            .join('\n')
  );

export const runReport = (
  runId: string | undefined,
  options: RunCommandOptions & { summary?: string }
): Promise<void> =>
  act(
    options,
    async ctx => {
      const id = await runOf(ctx, options, runId);
      if (options.summary) {
        await writeSummary(ctx, id, options.summary);
      }

      const loaded = await loadRun(ctx, id, { anyVersion: true });
      const summary = await readSummary(loaded);

      return { report: await buildReport(ctx, loaded), ...(summary === undefined ? {} : { summary }) };
    },
    ({ report, summary }) =>
      `${reportText(report, summary)}${summary === undefined ? '\nThe lead closes the run with its summary: plitzi run report --summary <file>' : ''}`
  );

export const taskAsk = (
  text: string,
  options: RunCommandOptions & { follow?: boolean; timeout?: number }
): Promise<void> =>
  act(
    options,
    async ctx => {
      const { runId, taskId } = await holder(ctx, options);

      return askLead(ctx, runId, taskId, text, {
        follow: options.follow ?? false,
        timeoutMs: (options.timeout ?? 30) * 60_000
      });
    },
    asked =>
      asked.reply
        ? [`The lead answered (${asked.reply.id}): ${asked.reply.text}`, ...messageLines(asked.messages)].join('\n')
        : options.follow
          ? `Asked (${asked.question.id}); no answer yet after ${String(options.timeout ?? 30)} min — go on with what you can, it comes with your next heartbeat.`
          : `Asked (${asked.question.id}): the answer comes with your next heartbeat, progress or completion — or stay for it with --follow.`
  );

export const taskMessage = (
  to: string,
  text: string,
  options: RunCommandOptions & { replyTo?: string }
): Promise<void> =>
  act(
    options,
    async ctx => messageTasks(ctx, await runOf(ctx, options), to, text, options.replyTo),
    sent =>
      sent.length === 0
        ? 'No task is in hand to tell.'
        : `Said to ${sent.map(message => message.to).join(', ')}: it reaches them with their next command.`
  );

export const taskInbox = (options: RunCommandOptions & { all?: boolean }): Promise<void> =>
  act(
    options,
    async ctx => readInbox(ctx, await runOf(ctx, options), ctx.token ? taskOf(ctx) : undefined, options.all ?? false),
    messages =>
      messages.length === 0
        ? options.all
          ? 'Nothing was said yet.'
          : 'Nothing unread (--all shows every message, read or not).'
        : messageLines(messages).join('\n')
  );

export const runPreview = async (
  runId: string | undefined,
  options: RunCommandOptions & { port?: number; task?: string }
): Promise<void> => {
  try {
    const ctx = await contextFor(options);
    const run = await runOf(ctx, options, runId);
    const { task } = options;
    const preview =
      task === undefined
        ? await startPreview(ctx, run, options.port ?? 8300)
        : await startTaskPreview(ctx, run, task, options.port ?? 8301);
    console.log(
      task === undefined
        ? `The run's work as it goes: ${preview.url} — served from ${preview.dir}; each approval shows in it. Ctrl-C stops it; it stops by itself when the run ends.`
        : `${task} as it went to review: ${preview.url} — served from its copy. Ctrl-C stops it; it stops by itself once the task leaves review.`
    );
    process.once('SIGINT', preview.stop);
    const ended = await preview.done;
    console.log(ended.why);
    process.exitCode = ended.code;
  } catch (error) {
    if (!isRunRefusal(error)) {
      throw error;
    }

    console.error(`${chalk.red(`Refused (${error.code}):`)} ${error.message}`);
    process.exitCode = error.exitCode;
  }
};
