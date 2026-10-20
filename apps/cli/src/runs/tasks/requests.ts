import fs from 'node:fs/promises';
import path from 'node:path';

import { readOptional, writeJson } from '../files';
import { ID, taskPaths, under } from '../paths';
import { RunRefusal } from '../refusal';
import { assertStatus, loadRun, logRun } from '../run';
import { putBlob, withLock } from '../store';
import { readRequests, readStart, requestId, updateState, viewTask, writeRequest } from '../taskStore';
import { buildRequestMerge, changeApproved } from './approve';
import { at, cleanPath, findTask, holderOf } from './common';
import { activeHolder, allLocks, sharedFiles } from './locks';

import type { RunTask, SharedRequest, TaskState } from '../model';
import type { LoadedRun, RunContext } from '../run';
import type { TaskView } from '../taskStore';

/**
 * A change to a file another task holds: a request, applied when its holder is approved — or by an integration task, one
 * a file, when it cannot wait.
 */

/** `plitzi task request`: why a task wants a change in a shared file, and where it uses it; `--blocking` cannot wait. */
export const requestShared = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  file: string,
  ask: { summary: string; usedIn: string[]; blocking: boolean }
): Promise<{ request: SharedRequest; integration?: string }> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'request a shared change');
  const task = findTask(loaded, taskId);
  const view = await holderOf(ctx, loaded, task);
  const clean = cleanPath(ctx.root, file);
  const planned = await activeHolder(loaded, clean);
  if (planned && planned.id !== taskId && !(await sharedFiles(loaded)).has(clean)) {
    throw new RunRefusal('claimed', `${clean} is task "${planned.id}"'s, not shared: wait for it (plitzi task wait)`, {
      file: clean,
      holder: planned.id
    });
  }

  const start = await readStart(view.paths);
  const request: SharedRequest = {
    id: requestId(clean),
    file: clean,
    summary: ask.summary,
    usedIn: ask.usedIn.length > 0 ? ask.usedIn : task.files,
    blocking: ask.blocking,
    at: at(ctx),
    base: start?.files[clean] ?? null,
    // What the copy holds now: a request made before the change is written again, as it is, at complete.
    wanted: await readOptional(under(view.paths.work, clean)).then(bytes =>
      bytes === undefined ? null : putBlob(loaded.paths, bytes)
    )
  };
  await writeRequest(view.paths, request);
  await logRun(ctx, loaded.paths, { action: 'request', task: taskId, file: clean, blocking: ask.blocking });
  if (!ask.blocking) {
    return { request };
  }

  const integration = await withLock(
    loaded.paths.mergeLock,
    () => integrationFor(ctx, loaded, clean, [`${taskId}/${request.id}`], []),
    {
      now: ctx.now
    }
  );
  await updateState(
    view.paths,
    state => ({
      ...state,
      status: 'waiting',
      waitingFor: { file: clean, task: integration, since: at(ctx) },
      notes: [...state.notes, { at: at(ctx), by: ctx.agent, text: `Waits for ${integration}, which makes ${clean}` }]
    }),
    ctx.now
  );

  return { request, integration };
};

const integrationAcceptance = async (
  loaded: LoadedRun,
  file: string,
  requests: readonly string[]
): Promise<string[]> => {
  const summaries: string[] = [];
  for (const request of requests) {
    const [requester, requestName] = request.split('/');
    const found = (await readRequests(taskPaths(loaded.paths, requester))).find(each => each.id === requestName);
    if (found) {
      summaries.push(`${requester}: ${found.summary}`);
    }
  }

  return [
    `Every request on ${file} applied together: ${summaries.join('; ')}`,
    'The pages of the requesting tasks pass their checks with it',
    'Contradictory requests are not picked between: they go to the lead or a person'
  ];
};

/** Adds `requests` to an integration task nobody works yet, after `dependsOn` too. Under the merge lock. */
const joinIntegration = async (
  ctx: RunContext,
  loaded: LoadedRun,
  task: RunTask,
  requests: readonly string[],
  dependsOn: readonly string[]
): Promise<void> => {
  const integrates = [...new Set([...(task.integrates ?? []), ...requests])];
  const joined: RunTask = {
    ...task,
    dependsOn: [...new Set([...task.dependsOn, ...dependsOn])],
    acceptance: await integrationAcceptance(loaded, task.files[0], integrates),
    integrates
  };
  const paths = taskPaths(loaded.paths, task.id);
  await writeJson(paths.definition, joined);
  loaded.tasks[loaded.tasks.indexOf(task)] = joined;
  await updateState(
    paths,
    state => ({
      ...state,
      notes: [...state.notes, { at: at(ctx), by: 'plitzi', text: `Joined by ${requests.join(', ')}` }]
    }),
    ctx.now
  );
  await logRun(ctx, loaded.paths, {
    action: 'integration',
    task: task.id,
    file: task.files[0],
    requests,
    joined: true
  });
};

/**
 * The integration task that applies `requests` on `file`: the one nobody works yet joined — one per file, so what is
 * asked meanwhile never races it — or a new one, after any already being worked. Under the merge lock.
 */
const integrationFor = async (
  ctx: RunContext,
  loaded: LoadedRun,
  file: string,
  requests: string[],
  dependsOn: string[]
): Promise<string> => {
  const open: { task: RunTask; view: TaskView }[] = [];
  for (const task of loaded.tasks.filter(each => each.kind === 'integration' && each.files.includes(file))) {
    const view = await viewTask(loaded.paths, task);
    if (view.state.status !== 'done') {
      open.push({ task, view });
    }
  }

  const waiting = open.find(each => !each.view.owner);
  if (waiting) {
    await joinIntegration(ctx, loaded, waiting.task, requests, dependsOn);

    return waiting.task.id;
  }

  return createIntegration(ctx, loaded, file, requests, [...dependsOn, ...open.map(each => each.task.id)]);
};

/** Makes an integration task on `file` for `requests` (as `<task>/<request>`), after `dependsOn`. Under the merge lock. */
const createIntegration = async (
  ctx: RunContext,
  loaded: LoadedRun,
  file: string,
  requests: string[],
  dependsOn: string[]
): Promise<string> => {
  const taken = new Set(loaded.tasks.map(task => task.id));
  const stem = `integrate-${requestId(file).toLowerCase()}`.slice(0, 56);
  let id = stem;
  for (let n = 2; taken.has(id) || !ID.test(id); n += 1) {
    id = `${stem}-${String(n)}`;
  }

  const task: RunTask = {
    id,
    title: `Integrate the requests on ${file}`,
    files: [file],
    dependsOn,
    priority: 'high',
    estimateMinutes: 15,
    acceptance: await integrationAcceptance(loaded, file, requests),
    kind: 'integration',
    integrates: requests
  };
  const paths = taskPaths(loaded.paths, id);
  await writeJson(paths.definition, task);
  await writeJson(paths.state, {
    status: 'ready',
    round: 0,
    notes: [{ at: at(ctx), by: 'plitzi', text: `Made by the CLI for ${requests.join(', ')}` }],
    updatedAt: at(ctx)
  } satisfies TaskState);
  loaded.tasks.push(task);
  await logRun(ctx, loaded.paths, { action: 'integration', task: id, file, requests });

  return id;
};

/** Every request of the run with whether an integration task covers it, and whether that task is done. */
export const requestsOf = async (
  loaded: LoadedRun
): Promise<{ task: string; request: SharedRequest; integratedBy?: string; integrated: boolean }[]> => {
  const covered = new Map<string, string>();
  for (const task of loaded.tasks) {
    task.integrates?.forEach(key => covered.set(key, task.id));
  }

  const all: { task: string; request: SharedRequest; integratedBy?: string; integrated: boolean }[] = [];
  for (const task of loaded.tasks) {
    for (const request of await readRequests(taskPaths(loaded.paths, task.id))) {
      const by = covered.get(`${task.id}/${request.id}`);
      const integrated =
        by !== undefined && (await viewTask(loaded.paths, findTask(loaded, by))).state.status === 'done';
      all.push({ task: task.id, request, ...(by ? { integratedBy: by } : {}), integrated });
    }
  }

  return all;
};

/** When every task that asked for a change in a shared file is approved, one integration task applies them all. */
export const integrateWhenReady = async (ctx: RunContext, loaded: LoadedRun): Promise<string[]> => {
  const made: string[] = [];
  const all = (await requestsOf(loaded)).filter(each => each.integratedBy === undefined);
  const byFile = new Map<string, typeof all>();
  all.forEach(each => byFile.set(each.request.file, [...(byFile.get(each.request.file) ?? []), each]));
  const locks = await allLocks(ctx);
  for (const [file, requests] of byFile) {
    const requesters = [...new Set(requests.map(each => each.task))];
    const states = await Promise.all(requesters.map(id => viewTask(loaded.paths, findTask(loaded, id))));
    // A file another task holds by turns waits for it: once it lets go, its requests are merged then, and only what
    // does not merge is integrated.
    const held = (locks.get(file) ?? []).some(each => each.live && !requesters.includes(each.task));
    if (held || !states.every(view => view.state.status === 'done')) {
      continue;
    }

    made.push(
      await integrationFor(
        ctx,
        loaded,
        file,
        requests.map(each => `${each.task}/${each.request.id}`),
        requesters
      )
    );
  }

  return made;
};

/**
 * The requests of done tasks on `files` — just let go of — merged into the run's work now when they merge line by line,
 * so they never wait for an integration task. An integration task left with none of its requests to apply, and nobody
 * on it, is done: said in its notes.
 */
export const settleRequests = async (
  ctx: RunContext,
  loaded: LoadedRun,
  files: readonly string[]
): Promise<string[]> => {
  const settled: string[] = [];
  for (const each of await requestsOf(loaded)) {
    if (!files.includes(each.request.file) || each.integrated) {
      continue;
    }

    const requester = await viewTask(loaded.paths, findTask(loaded, each.task));
    if (requester.state.status !== 'done') {
      continue;
    }

    const went = await changeApproved(ctx, loaded, approved =>
      buildRequestMerge(ctx, loaded, requester, each.request, approved)
    );
    if (went !== undefined && !('failed' in went)) {
      await fs.rm(path.join(requester.paths.requests, `${each.request.id}.json`), { force: true });
      settled.push(`${each.task}/${each.request.id}`);
    }
  }

  if (settled.length === 0) {
    return [];
  }

  const left = new Set((await requestsOf(loaded)).map(each => `${each.task}/${each.request.id}`));
  for (const task of loaded.tasks.filter(each => each.kind === 'integration')) {
    const view = await viewTask(loaded.paths, task);
    const open = (task.integrates ?? []).filter(key => left.has(key));
    if (open.length === 0 && !view.owner && (view.state.status === 'ready' || view.state.status === 'pending')) {
      await updateState(
        view.paths,
        state => ({
          ...state,
          status: 'done',
          notes: [
            ...state.notes,
            {
              at: at(ctx),
              by: 'plitzi',
              text: 'Nothing left to integrate: every request merged as the file was let go of'
            }
          ]
        }),
        ctx.now
      );
      settled.push(task.id);
    }
  }

  await logRun(ctx, loaded.paths, { action: 'settle', settled });

  return settled;
};
