import fs from 'node:fs/promises';

import { writeJson } from '../files';
import { requireLead } from '../leads';
import { AGENT, agentAddress, LEAD, sendMessage } from '../messages';
import { syncPreview } from '../preview';
import { stopListenersUnder } from '../processes';
import { RunRefusal } from '../refusal';
import { assertStatus, loadRun, logRun, readApproved, requireNoTask } from '../run';
import { withLock } from '../store';
import { cutTask, lockedFiles, updateState, viewTask } from '../taskStore';
import { readTeam, startedAgents } from '../team';
import { at, findTask, roleOf } from './common';
import { grantWaiters } from './locks';
import { integrateWhenReady, settleRequests } from './requests';
import { spareTests } from './spareTests';
import { takeTask } from './take';
import { writesTests } from '../tests';

import type { TakenTask } from './take';
import type { ApprovedFile, RunTask } from '../model';
import type { LoadedRun, RunContext } from '../run';
import type { TaskView } from '../taskStore';

/**
 * A task taken back: reassigned — cut, for another to take — or reverted, its work taken out of the run.
 */

/** What `task reassign` is told: why, and to whom — an agent of the team, or the lead itself (`lead`). */
export interface ReassignAsked {
  reason?: string;
  to?: string;
}

/**
 * `plitzi task reassign`: the lead or a person takes a task back from its agent — its holder's token revoked, told why
 * on its next command, the servers it left in the copy stopped — for another to take: anyone, the agent it is handed to
 * (`--to dev-2`), or the lead itself (`--to lead`, taken now, a copy of its own).
 */
export const reassignTask = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  asked: ReassignAsked = {}
): Promise<{
  from?: string;
  reviewedRound?: number;
  released: string[];
  granted: string[];
  settled: string[];
  integrations: string[];
  servers: string[];
  to?: string;
  taken?: TakenTask;
}> => {
  requireNoTask(ctx, 'reassign a task');
  const loaded = await loadRun(ctx, runId);
  await requireLead(ctx, 'reassign a task');
  const task = findTask(loaded, taskId);
  const view = await viewTask(loaded.paths, task);
  if (view.state.status === 'done') {
    throw new RunRefusal('invalid', `Task "${taskId}" is done: revert it instead (plitzi task revert ${taskId})`);
  }

  // Whom it goes to is checked before anything is cut: a refusal leaves the task with its agent.
  const lead = asked.to === LEAD || asked.to === ctx.agent ? ctx.agent : undefined;
  const to =
    asked.to !== undefined && lead === undefined
      ? await handable(
          ctx,
          loaded,
          asked.to,
          task,
          await Promise.all(loaded.tasks.map(each => viewTask(loaded.paths, each)))
        )
      : undefined;

  // What it held by turns is let go with it — handed to whoever waits, its requests merged — not left until its locks
  // run out half an hour after its agent went quiet.
  const turns = [...(await lockedFiles(view.paths))].filter(([, lock]) => lock.kind === 'turn').map(([file]) => file);
  // What its agent left listening in the copy goes with it: a server of a copy no one holds is no one's to stop.
  const servers = stopListenersUnder(view.paths.work).map(server => `:${String(server.port)}`);
  await cutTask(view, `reassigned by ${ctx.agent}${asked.reason ? `: ${asked.reason}` : ''}`, ctx.now);
  if (to !== undefined) {
    await updateState(
      view.paths,
      state => ({
        ...state,
        handTo: {
          agent: to,
          by: ctx.agent,
          at: ctx.now().toISOString(),
          ...(asked.reason ? { reason: asked.reason } : {})
        }
      }),
      ctx.now
    );
  }

  const refreshed = await loadRun(ctx, runId);
  const granted = await grantWaiters(ctx, refreshed, turns);
  const settled = await settleRequests(ctx, refreshed, turns);
  const integrations = await withLock(refreshed.paths.mergeLock, () => integrateWhenReady(ctx, refreshed), {
    now: ctx.now
  });
  const from = view.owner?.agent;
  // Its agent learns it with its next command, and why — never only by a refusal of a token cut.
  if (from !== undefined && from !== ctx.agent) {
    await sendMessage(ctx, refreshed, {
      from: LEAD,
      to: agentAddress(from),
      text: `${taskId} was taken back by ${ctx.agent}${asked.reason ? `: ${asked.reason}` : ''} — it is not yours now${to ? `; it goes to ${to}` : lead ? `; ${lead} takes it` : ''}. Stop working in its copy: plitzi task next`
    });
  }

  await logRun(ctx, loaded.paths, {
    action: 'reassign',
    task: taskId,
    from,
    ...(asked.reason ? { reason: asked.reason } : {}),
    ...(to ? { to } : lead ? { to: lead } : {}),
    released: turns,
    granted,
    settled,
    integrations,
    servers
  });
  const taken = lead === undefined ? undefined : await takeTask(ctx, runId, taskId);

  return {
    ...(from ? { from } : {}),
    ...(view.reviewed ? { reviewedRound: view.reviewed.round } : {}),
    released: turns,
    granted,
    settled,
    integrations,
    servers,
    ...(to ? { to } : lead ? { to: lead } : {}),
    ...(taken ? { taken } : {})
  };
};

/** The agent a task may be handed to: one of the team, of the task's role — refused, naming who may, otherwise. */
const handable = async (
  ctx: RunContext,
  loaded: LoadedRun,
  agent: string,
  task: RunTask,
  views: readonly TaskView[]
): Promise<string> => {
  const team = await readTeam(ctx.root).catch(() => undefined);
  const members = team ? startedAgents(team) : [];
  const member = members.find(each => each.agent === agent);
  const role = roleOf(task);
  if (!member) {
    throw new RunRefusal(
      'invalid',
      `${agent} is no agent of the team: hand ${task.id} to one of ${members.map(each => each.agent).join(', ') || 'the team (team.json)'}, or take it yourself (plitzi task reassign ${task.id} --to lead)`,
      { task: task.id }
    );
  }

  // The tests of what it worked are another's, as `task take` holds.
  if (!writesTests(task, agent, views)) {
    throw new RunRefusal(
      'invalid',
      `${agent} worked what ${task.id} tests (${(task.testsOf ?? []).join(', ')}): hand it to one that did not write the work`,
      { task: task.id }
    );
  }

  if (!member.roles.includes(role) && !(await spareTests(loaded, views, agent))(task)) {
    throw new RunRefusal(
      'invalid',
      `${agent} is a ${member.roles.join(', ')}, and ${task.id} a ${role}'s: hand it to ${
        members
          .filter(each => each.roles.includes(role))
          .map(each => each.agent)
          .join(', ') || 'no one of the team'
      }`,
      { task: task.id, role }
    );
  }

  return agent;
};

/**
 * `plitzi task revert`: what one approved task brought into the run's work taken back out, before the final merge — the
 * others' untouched. A file another task changed after it is not reverted, and is said.
 */
export const revertTask = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  reason?: string
): Promise<{ reverted: string[]; kept: string[]; dependants: string[]; waiting: string[] }> => {
  requireNoTask(ctx, 'revert a task');
  const loaded = await loadRun(ctx, runId);
  await requireLead(ctx, 'revert a task');
  if (reason === undefined || reason.trim() === '') {
    throw new RunRefusal(
      'invalid',
      'A revert says why — kept in its notes, and said to whoever takes it again: plitzi task revert <task> --reason "…"',
      {
        task: taskId
      }
    );
  }

  assertStatus(loaded, ['open', 'stopping', 'stopped'], 'revert a task');
  const task = findTask(loaded, taskId);
  const view = await viewTask(loaded.paths, task);
  if (view.state.status !== 'done') {
    throw new RunRefusal('invalid', `Task "${taskId}" is ${view.state.status}: only an approved task is reverted`);
  }

  const reverted: string[] = [];
  const kept: string[] = [];
  await withLock(
    loaded.paths.mergeLock,
    async () => {
      const approved = await readApproved(loaded.paths);
      const files: Record<string, ApprovedFile> = {};
      for (const [file, entry] of Object.entries(approved.files)) {
        if (entry.task === taskId) {
          if (entry.previous) {
            files[file] = entry.previous;
          }

          reverted.push(file);
          continue;
        }

        let previous = entry.previous;
        while (previous) {
          if (previous.task === taskId) {
            kept.push(file);
            break;
          }

          previous = previous.previous;
        }

        files[file] = entry;
      }

      await writeJson(loaded.paths.approved, { files, tasks: approved.tasks.filter(id => id !== taskId) });
    },
    { now: ctx.now }
  );
  await fs.rm(view.paths.reviewed, { force: true });
  await updateState(
    view.paths,
    state => ({
      ...state,
      status: 'ready',
      round: 0,
      notes: [
        ...state.notes,
        {
          at: at(ctx),
          by: ctx.agent,
          text: `Reverted${reason ? ` — ${reason}` : ''}: ${reverted.join(', ') || 'nothing'}`
        }
      ]
    }),
    ctx.now
  );
  // Whoever takes it again hears why, with its take: what to redo, not only that it is to be redone.
  if (reason) {
    await sendMessage(ctx, loaded, {
      from: LEAD,
      to: taskId,
      text: `This task was reverted and is to be done again: ${reason}`
    });
  }

  // …and the agents who did it hear it by name: their work is out of the run, whoever redoes it.
  const workedBy = [
    ...new Set(view.state.notes.filter(note => note.text.startsWith('Taken')).map(note => note.by))
  ].filter(agent => AGENT.test(agentAddress(agent)));
  for (const agent of workedBy) {
    await sendMessage(ctx, loaded, {
      from: LEAD,
      to: agentAddress(agent),
      text: `Your work on ${taskId} was reverted${reason ? `: ${reason}` : ''} — out of the run; plitzi task next hands it on`
    });
  }

  // What was built on it waits for it again: not started, it goes back to pending; in hand, its agent is told.
  const dependants = loaded.tasks.filter(each => each.dependsOn.includes(taskId));
  const waiting: string[] = [];
  for (const dependant of dependants) {
    const dependantView = await viewTask(loaded.paths, dependant);
    if (dependantView.state.status === 'done') {
      continue;
    }

    const notStarted = !dependantView.owner && dependantView.state.status === 'ready';
    await updateState(
      dependantView.paths,
      state => ({
        ...state,
        ...(notStarted ? { status: 'pending' as const } : {}),
        notes: [
          ...state.notes,
          {
            at: at(ctx),
            by: 'plitzi',
            text: notStarted
              ? `"${taskId}", which it depends on, was reverted: it waits for it again`
              : `"${taskId}", which it depends on, was reverted (${reverted.join(', ') || 'nothing'}): what it builds on is not in the run any more`
          }
        ]
      }),
      ctx.now
    );
    if (notStarted) {
      waiting.push(dependant.id);
    }
  }

  await syncPreview(await loadRun(ctx, runId), ctx.root);
  await logRun(ctx, loaded.paths, { action: 'revert', task: taskId, reverted, kept, waiting });

  return { reverted, kept, dependants: dependants.map(each => each.id), waiting };
};
