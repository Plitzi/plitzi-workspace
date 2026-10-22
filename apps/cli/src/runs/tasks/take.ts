import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { proposalsOf, unansweredTo } from '../agreements';
import { cloneFiles, cloneServed, createExclusive, isCopied, projectFiles, writeJson } from '../files';
import { handOver } from '../handOver';
import { assertRoles } from '../identity';
import { COPY_TASK_FILE, isSecretFile, lockFile, under } from '../paths';
import { dependenciesDone } from '../plan';
import { RunRefusal } from '../refusal';
import { assertStatus, loadRun, logRun, readApproved } from '../run';
import { keepFiles, placeVersion, withLock } from '../store';
import { appendLog, cutTask, locksExpired, readOwner, revokeOwner, updateState, viewTask } from '../taskStore';
import { isWorked } from '../worked';
import { at, findTask, roleOf } from './common';
import { allLocks, sharedFiles } from './locks';

import type { ProposalView } from '../agreements';
import type { Message } from '../messages';
import type { FileLock, RunTask, TaskStart, TaskStatus } from '../model';
import type { RunContext } from '../run';
import type { TaskView } from '../taskStore';

/**
 * `plitzi task take`: a task taken — its owner created exclusively, its files locked, its copy of the project made.
 */

export interface TakenTask {
  task: RunTask;
  token: string;
  work: string;
  files: string[];
  /** Where its copy starts from: its last reviewed version, or none. */
  resumedFrom?: number;
  replaced?: string;
  /** What other tasks proposed to it and wait for an answer to (plitzi task answer). */
  proposals: ProposalView[];
  /** What the lead said to it and it had not read. */
  messages: Message[];
}

/**
 * `plitzi task take`: the task's owner made exclusively — of two at once, the first wins and the other is told to take
 * the next — its files locked, and its copy made: the project, the run's approved work over it, and the task's last
 * reviewed version if it was cut.
 */
export const takeTask = async (ctx: RunContext, runId: string, taskId: string, role?: string): Promise<TakenTask> => {
  if (ctx.token !== undefined) {
    throw new RunRefusal('invalid', 'Take a task without a token: the token is what taking it gives');
  }

  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open'], 'start a task');
  const task = findTask(loaded, taskId);
  if (role !== undefined && roleOf(task) !== role) {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}" is a ${roleOf(task)}’s, not a ${role}’s: plitzi task next --role ${role}`,
      {
        task: taskId,
        role: roleOf(task)
      }
    );
  }

  await assertRoles(ctx.root, ctx.agent, [roleOf(task)]);
  let view = await viewTask(loaded.paths, task);
  const states = new Map(
    await Promise.all(loaded.tasks.map(async each => [each.id, (await viewTask(loaded.paths, each)).state] as const))
  );
  if (view.state.status === 'done') {
    throw new RunRefusal('invalid', `Task "${taskId}" is done`, { task: taskId });
  }

  if (view.state.status === 'in-review') {
    throw new RunRefusal('invalid', `Task "${taskId}" is in review: take another (plitzi task next)`, { task: taskId });
  }

  // A spike is a lead's: what is built is decided by what a lead finds out, never by the agent that builds it.
  if (view.state.status === 'spike') {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}" is in spike: a lead finds out first (${task.spike ?? 'what it needs'}) — take another (plitzi task next)`,
      { task: taskId }
    );
  }

  if (!dependenciesDone(task, states)) {
    const pending = task.dependsOn.filter(dependency => states.get(dependency)?.status !== 'done');
    throw new RunRefusal('invalid', `Task "${taskId}" waits for ${pending.join(', ')} to be done`, {
      task: taskId,
      dependsOn: pending
    });
  }

  if (view.state.status === 'blocked') {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}" is blocked: ${view.state.blockedBy?.reason ?? ''} (${view.state.blockedBy?.needs ?? 'person'})`,
      { task: taskId }
    );
  }

  let replaced: string | undefined;
  if (view.owner) {
    if (!locksExpired(task, view.signalAt, ctx.now())) {
      if (view.owner.agent === ctx.agent) {
        throw new RunRefusal(
          'claimed',
          `Task "${taskId}" is yours already (${ctx.agent}, ${view.state.status}): no take — go on with its token (plitzi task context ${taskId})`,
          { task: taskId, holder: view.owner.agent, yours: true, next: `plitzi task context ${taskId} with its token` }
        );
      }

      throw new RunRefusal('claimed', `Task "${taskId}" is ${view.owner.agent}'s`, {
        task: taskId,
        holder: view.owner.agent,
        next: 'take the next one: plitzi task next'
      });
    }

    replaced = view.owner.agent;
    await cutTask(view, `${view.owner.agent} had no signal`, ctx.now);
    view = await viewTask(loaded.paths, task);
  }

  // The token names its run and task, so every command of the task needs only it.
  const token = `${runId}.${taskId}.${randomBytes(24).toString('hex')}`;
  const owner = { agent: ctx.agent, token, takenAt: at(ctx), machine: ctx.machine };
  // The agents at work are counted and the task taken under one lock: two takes at once never pass the limit together.
  await withLock(
    loaded.paths.takeLock,
    async () => {
      const working = (await Promise.all(loaded.tasks.map(each => viewTask(loaded.paths, each)))).filter(
        each => each.task.id !== taskId && each.owner !== undefined && isWorked(each.state.status)
      );
      // The limit is on agents, not tasks: one that holds two — its own sent back while it works another — is one, and
      // taking one more adds no agent.
      const agents = new Set(working.map(each => each.owner?.agent));
      if (!agents.has(ctx.agent) && agents.size >= loaded.record.agents) {
        throw new RunRefusal(
          'agent-limit',
          `${String(agents.size)} of the ${String(loaded.record.agents)} agents run "${runId}" allows are at work (${working.map(each => `${each.task.id}: ${String(each.owner?.agent)}`).join(', ')}): take "${taskId}" when one of them finishes`,
          { task: taskId, working: working.map(each => each.task.id), limit: loaded.record.agents }
        );
      }

      if (!(await createExclusive(view.paths.owner, `${JSON.stringify(owner, null, 2)}\n`))) {
        const holder = await readOwner(view.paths);
        throw new RunRefusal('claimed', `Task "${taskId}" was taken meanwhile${holder ? ` by ${holder.agent}` : ''}`, {
          task: taskId,
          ...(holder ? { holder: holder.agent } : {}),
          next: 'take the next one: plitzi task next'
        });
      }

      // Counted as at work from now, before its copy is made: the next take under the lock sees it.
      await updateState(view.paths, state => ({ ...state, status: takenStatus(state.status) }), ctx.now);
    },
    { now: ctx.now }
  );

  try {
    const locks = await allLocks(ctx);
    for (const file of task.files) {
      const other = (locks.get(file) ?? []).find(held => held.live && !(held.run === runId && held.task === taskId));
      if (other) {
        throw new RunRefusal(
          'claimed',
          `${file} is held by task "${other.task}"${other.run === runId ? '' : ` of run "${other.run}"`}`,
          { file, holder: other.task, ...(other.until ? { until: other.until } : {}) }
        );
      }
    }

    await holdFiles(ctx, runId, view, task);

    // Its files and the shared ones as the project holds them now, kept: the base of every conflict this task can meet,
    // and of the diff of every request it makes.
    await keepFiles(loaded.paths, ctx.root, [...new Set([...task.files, ...(await sharedFiles(loaded))])]);
    await fs.rm(view.paths.cache, { recursive: true, force: true });
    const keep = new Set(task.files);
    const all = await projectFiles(ctx.root);
    const files = all.filter(file => isCopied(file, keep));
    // The pictures it does not own come too, unread, so its pages draw them — a look at it is of the page a visitor sees.
    const served = await cloneServed(
      ctx.root,
      view.paths.work,
      // Never a secret: projectFiles leaves them out, and this is said again where binaries are let in.
      all.filter(file => !isSecretFile(file) && !isCopied(file, keep))
    );
    const start: TaskStart = {
      copiedAt: at(ctx),
      files: await cloneFiles(ctx.root, view.paths.work, files),
      overlaid: [],
      ...(Object.keys(served).length > 0 ? { served } : {})
    };
    // Never copied, never counted: there for what the agent writes aside (a server's log), as in the project — and for
    // who the copy is, so a command run inside it needs no token, run or agent said.
    await fs.mkdir(path.join(view.paths.work, 'tmp'), { recursive: true });
    await writeJson(path.join(view.paths.work, COPY_TASK_FILE), { run: runId, task: taskId, token, agent: ctx.agent });
    const approved = await readApproved(loaded.paths);
    for (const [file, entry] of Object.entries(approved.files)) {
      await placeVersion(loaded.paths, under(view.paths.work, file), entry.digest);
      start.files[file] = entry.digest;
      start.overlaid.push(file);
    }

    start.overlaid.sort();
    await writeJson(view.paths.start, start);
    if (view.reviewed) {
      for (const [file, digest] of Object.entries(view.reviewed.files)) {
        await placeVersion(loaded.paths, under(view.paths.work, file), digest);
      }
    }

    await writeJson(view.paths.progress, { heartbeatAt: at(ctx) });
    await updateState(
      view.paths,
      state => ({
        ...state,
        status: takenStatus(state.status),
        cutAt: undefined,
        notes: [
          ...state.notes,
          { at: at(ctx), by: ctx.agent, text: replaced ? `Taken over from ${replaced}, who had no signal` : 'Taken' }
        ]
      }),
      ctx.now
    );
  } catch (error) {
    await fs.rm(view.paths.locks, { recursive: true, force: true });
    await revokeOwner(view.paths);
    await updateState(view.paths, state => ({ ...state, status: 'ready' }), ctx.now);
    throw error;
  }

  await appendLog(view.paths.log, { at: at(ctx), by: ctx.agent, action: 'take' });
  await logRun(ctx, loaded.paths, { action: 'take', task: taskId, ...(replaced ? { replaced } : {}) });

  return {
    task,
    token,
    work: view.paths.work,
    files: task.files,
    ...(view.reviewed ? { resumedFrom: view.reviewed.round } : {}),
    ...(replaced ? { replaced } : {}),
    proposals: unansweredTo(await proposalsOf(loaded), taskId),
    messages: await handOver(ctx, loaded, taskId, ctx.agent)
  };
};

/** The status a take leaves a task in: sent back stays sent back, anything else is at work. */
const takenStatus = (status: TaskStatus): TaskStatus => (status === 'changes-requested' ? status : 'in-progress');

/** Its own files held for it: what a task building them takes — at its take, or once its spike is answered. */
export const holdFiles = async (ctx: RunContext, runId: string, view: TaskView, task: RunTask): Promise<void> => {
  for (const file of task.files) {
    const lock: FileLock = {
      runId,
      taskId: task.id,
      agent: ctx.agent,
      intent: task.title,
      since: at(ctx),
      kind: 'own'
    };
    await writeJson(lockFile(view.paths, file), lock);
  }
};
