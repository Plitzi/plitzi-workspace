import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseEnv } from 'node:util';

import { STATE_DIR_ENV } from '@plitzi/sdk-shared/project';
import { RUN_STATUS_ENV } from '@plitzi/sdk-shared/runs';

import { answering, ownServer, serveCopy } from './acceptance';
import {
  canLinger,
  keepServer,
  keptServer,
  markPreviewed,
  previewServerLog,
  touchKept,
  unmarkPreviewed
} from './lingering';
import { alive, isPreview, previewPort, previewRecord } from './previewRecord';
import { stopTree } from './processes';
import { failedWhy, scriptsOf, tail } from '../../commands/project/verify';
import {
  cloneFiles,
  fingerprint,
  isCopied,
  projectFiles,
  readJson,
  readOptional,
  writeAtomic,
  writeJson
} from '../core/files';
import { agentScratch, RUN_COPY_MARK, taskPaths, under } from '../core/paths';
import { RunRefusal } from '../core/refusal';
import { placeVersion } from '../core/store';
import { viewTask } from '../core/taskStore';
import { loadRun, readApproved, readBase, readRecord, requireNoTask } from '../run';
import { digestsOf } from '../tasks/approve';
import { monitorRun } from '../view/monitor';

import type { LoadedRun, RunContext } from '../run';
import type { Monitored } from '../view/monitor';
import type { TaskLine } from '../view/view';
import type { RunSnapshot } from '@plitzi/sdk-shared/runs';

/**
 * The run's work as it goes: the project with every approved task over it, served by the project's own dev
 * server in the run's cache — what is connected shows the moment it is approved, not only at the final merge. Each
 * approval puts its files into it, and the dev server swaps them in. Never the project itself: its files stay as they
 * are until the final merge. The `.env` is read from the project and handed to the server, never copied into the run.
 */

/** Where a run's preview materialises its approved work: what `page check --url` finds a preview's space by. */
export const previewDir = (paths: { cache: string }): string => path.join(paths.cache, 'preview');
/** The run as the preview's page shows it in its dev tools (`RUN_STATUS_PATH`), written as it goes. */
const snapshotFile = (loaded: LoadedRun): string => path.join(loaded.paths.cache, 'preview-run.json');

/** The run's view, as the dev tools read it (`RunSnapshot`): what a person looking at the page wants of the run. */
/** Why a task is not moving, said once for every surface that shows the run: what it starts after, waits for, needs. */
const whyOf = (task: TaskLine): { why?: string } =>
  task.asking
    ? {
        why: task.asking.answered
          ? `answered (${task.asking.id}): its agent takes it up with its next command`
          : `waits for the lead's answer to ${task.asking.id}: ${task.asking.text}`
      }
    : task.waitsOn
      ? { why: `starts once ${task.waitsOn.join(', ')} ${task.waitsOn.length === 1 ? 'is' : 'are'} approved` }
      : task.status === 'waiting' && task.waitingFor
        ? { why: `waits for ${task.waitingFor.task}${task.waitingFor.file ? `: ${task.waitingFor.file}` : ''}` }
        : task.status === 'blocked' && task.blockedBy
          ? { why: `blocked — ${task.blockedBy.reason} (needs ${task.blockedBy.needs})` }
          : task.parkedFor
            ? { why: `${task.agent ?? 'its agent'} is at ${task.parkedFor} first — one task at a time` }
            : task.leadFindsOut
              ? { why: `the lead finds it out: ${task.spike ?? 'what it needs'}` }
              : task.status === 'ready'
                ? { why: 'free to take: the next agent at work takes it' }
                : task.status === 'in-review'
                  ? {
                      why: task.proposed
                        ? `${task.proposed.by} found it out: the lead decides`
                        : `its ${task.review?.role ?? ''} review — ${task.review?.by ?? 'not taken yet'}${task.review && task.review.step + 1 < task.review.steps.length ? `; then its ${task.review.steps.slice(task.review.step + 1).join(', then ')}'s` : ''}`
                    }
                  : {};

export const snapshotOf = ({ view, agents, feed }: Monitored, at: Date): RunSnapshot => ({
  runId: view.runId,
  goal: view.goal,
  status: view.status,
  done: view.done,
  total: view.total,
  at: at.toISOString(),
  ...(view.expectedEnd ? { expectedEnd: view.expectedEnd } : {}),
  tasks: view.tasks.map(task => ({
    id: task.id,
    title: task.title,
    role: task.role,
    status: task.status,
    ...(task.agent ? { agent: task.agent } : {}),
    ...(task.review?.by ? { reviewer: task.review.by } : {}),
    round: task.round,
    files: task.files,
    ...(task.step ? { step: task.step } : {}),
    ...(task.fraction !== undefined ? { fraction: task.fraction } : {}),
    ...whyOf(task),
    urgency: task.urgency,
    ...(task.found !== undefined ? { found: task.found } : {})
  })),
  attention: view.attention.map(item => ({ text: item.text, who: item.who })),
  agents: agents.map(each => ({
    agent: each.agent,
    kind: each.kind,
    status: each.status,
    ...(each.model ? { model: each.model } : {}),
    doing: each.doing,
    ...(each.task ? { task: each.task } : {})
  })),
  feed: feed.slice(0, 40).map(each => ({
    at: each.at,
    by: each.by,
    text: each.text,
    ...(each.detail === undefined ? {} : { detail: each.detail }),
    kind: each.kind
  }))
});

const writeSnapshot = async (ctx: RunContext, loaded: LoadedRun): Promise<void> => {
  await writeAtomic(
    snapshotFile(loaded),
    `${JSON.stringify(snapshotOf(await monitorRun(ctx, loaded.record.runId), ctx.now()))}\n`
  );
};

/** Puts the run's approved work into a running preview — none running, nothing done. Answers whether it did. */
export const syncPreview = async (loaded: LoadedRun, root: string): Promise<boolean> => {
  const running = await readJson(previewRecord(loaded.paths), isPreview, 'a run’s preview').catch(() => undefined);
  if (!running || !alive(running.pid)) {
    return false;
  }

  const dir = previewDir(loaded.paths);
  const approved = (await readApproved(loaded.paths)).files;
  for (const [file, entry] of Object.entries(approved)) {
    // Only what changed is written: every write is a reload in the open page.
    if ((await fingerprint(under(dir, file))) !== entry.digest) {
      await placeVersion(loaded.paths, under(dir, file), entry.digest, dir);
    }
  }

  // A file the run touches and no longer approves — its task reverted — is the project's again.
  for (const file of Object.keys((await readBase(loaded.paths)).files)) {
    if (Object.hasOwn(approved, file)) {
      continue;
    }

    const project = await fingerprint(under(root, file));
    if ((await fingerprint(under(dir, file))) === project) {
      continue;
    }

    if (project === null) {
      await fs.rm(under(dir, file), { force: true });
    } else {
      await fs.mkdir(path.dirname(under(dir, file)), { recursive: true });
      await fs.copyFile(under(root, file), under(dir, file));
    }
  }

  return true;
};

export interface Preview {
  url: string;
  dir: string;
  /** Ends when the run ends, the server stops, or the caller stops it: what it ended with. */
  done: Promise<{ code: number; why: string }>;
  stop: () => void;
  /**
   * A task's copy already served, on this port: by its agent's own server, or by the one a picture of it kept — looked
   * at there, never started again.
   */
  borrowed?: { port: number; by: 'agent' | 'kept' };
  /** Once it stopped, why — and what the server said last, when it wrote to a log: none while it serves. */
  stopped: () => { why: string; said: string[] } | undefined;
  /** Where its server writes, when it was started quiet: what a panel shows of it (`run monitor`). */
  log?: string;
}

/**
 * Serves `dir` with the project's own dev server on `port`, the project's `.env` handed to it, until the run ends,
 * `ended` gives a reason to stop, or the caller stops it.
 */
const serve = async (
  ctx: RunContext,
  loaded: LoadedRun,
  dir: string,
  port: number,
  ended: () => Promise<string | undefined> = () => Promise.resolve(undefined),
  {
    quiet = false,
    snapshot = false,
    log,
    stateDir
  }: {
    quiet?: boolean;
    snapshot?: boolean;
    /** Where a quiet server's output goes: what says why, when it stops under a look (silent). */
    log?: string;
    /** What the server keeps, apart from the folder's own (`PLITZI_STATE_DIR`): a cold start, beside any other. */
    stateDir?: string;
  } = {}
): Promise<Omit<Preview, 'dir'>> => {
  const scripts = await scriptsOf(dir);
  const script = scripts['start:dev'] ? 'start:dev' : scripts.start ? 'start' : undefined;
  if (!script) {
    throw new RunRefusal('invalid', 'The project has no start or start:dev script to serve the run’s work with');
  }

  const env = (await readOptional(path.join(ctx.root, '.env')))?.toString('utf-8');
  const logged = quiet && log !== undefined ? await fs.open(log, 'w') : undefined;
  const child = spawn(scripts[script], {
    cwd: dir,
    shell: true,
    // Quiet for a command that says its own findings (`task look`): the server's start lines are not its answer — kept
    // in its log, for when it stops.
    stdio: logged ? ['ignore', logged.fd, logged.fd] : quiet ? 'ignore' : 'inherit',
    env: {
      ...process.env,
      ...(env ? parseEnv(env) : {}),
      PORT: String(port),
      ...(stateDir === undefined ? {} : { [STATE_DIR_ENV]: stateDir }),
      ...(snapshot ? { [RUN_STATUS_ENV]: snapshotFile(loaded) } : {}),
      PATH: `${path.join(ctx.root, 'node_modules', '.bin')}${path.delimiter}${process.env.PATH ?? ''}`
    }
  });

  void logged?.close();
  let why: string | undefined;
  let exited: { why: string; said: string[] } | undefined;
  const stop = (): void => {
    why ??= 'the preview stopped: it was asked to';
    stopTree(child);
  };
  const done = new Promise<{ code: number; why: string }>(resolve => {
    const watch = setInterval(() => {
      void (async () => {
        const record = await readRecord(loaded.paths).catch(() => undefined);
        const reason = record ? await ended() : 'the preview stopped: the run ended';
        // What the page's dev tools show of the run; one not written this round is written the next.
        if (snapshot && record) {
          await writeSnapshot(ctx, loaded).catch(() => undefined);
        }
        if (reason !== undefined) {
          why ??= reason;
          stopTree(child);
        }
      })();
    }, 2000);
    child.on('exit', code => {
      clearInterval(watch);
      const ended =
        why === undefined ? { code: code ?? 1, why: `the server stopped (${String(code)})` } : { code: 0, why };
      void (log === undefined ? Promise.resolve('') : fs.readFile(log, 'utf-8').catch(() => '')).then(text => {
        exited = { why: ended.why, said: tail(text.trim()) };
        resolve(ended);
      });
    });
  });

  return {
    url: `http://127.0.0.1:${String(port)}`,
    done,
    stop,
    stopped: () => exited,
    ...(logged && log !== undefined ? { log } : {})
  };
};

/**
 * A server someone else runs, followed until it stops answering or the caller is done with it: never stopped — and a
 * kept one's use marked while it is followed (`touch`), so its watchdog does not stop it under a look.
 */
const borrow = (url: string, touch?: () => Promise<void>): Omit<Preview, 'dir'> => {
  let release: (why: string) => void = () => undefined;
  let ended: { why: string; said: string[] } | undefined;
  const done = new Promise<{ code: number; why: string }>(resolve => {
    const watch = setInterval(() => {
      void touch?.().catch(() => undefined);
      void answering(url, 1_000).then(up => {
        if (!up) {
          release('the server it was served by stopped');
        }
      });
    }, 2000);
    release = why => {
      clearInterval(watch);
      ended ??= { why, said: [] };
      resolve({ code: 0, why });
    };
  });

  return { url, done, stop: () => release('the preview stopped: it was asked to'), stopped: () => ended };
};

/** Where a quiet preview's server writes: beside the run, read by the panel that started it. */
export const previewLog = (paths: { cache: string }): string => path.join(paths.cache, 'preview.log');

/**
 * `plitzi run preview`: the run's work served on `port`, kept up to date until the run ends. `quiet`: its server's
 * output goes to `previewLog`, not to the terminal — the monitor draws its own screen there.
 */
export const startPreview = async (
  ctx: RunContext,
  runId: string,
  port: number,
  { quiet = false }: { quiet?: boolean } = {}
): Promise<Preview> => {
  requireNoTask(ctx, 'preview the run');
  const loaded = await loadRun(ctx, runId, { anyVersion: true });
  // One preview a run: a second would rebuild the folder the first one serves from under it.
  const running = await previewPort(loaded);
  if (running !== undefined) {
    throw new RunRefusal(
      'invalid',
      `Run "${runId}" is previewed already, on http://127.0.0.1:${String(running)}: open it there — a second preview would rebuild the folder that one serves from`,
      { next: `open http://127.0.0.1:${String(running)}` }
    );
  }

  const dir = previewDir(loaded.paths);
  await approvedCopy(ctx, loaded, dir);
  await writeSnapshot(ctx, loaded);
  const log = quiet ? previewLog(loaded.paths) : undefined;
  const served = await serve(ctx, loaded, dir, port, undefined, {
    snapshot: true,
    ...(log === undefined ? {} : { quiet: true, log })
  });
  await writeJson(previewRecord(loaded.paths), { pid: process.pid, port });
  void served.done.then(() => fs.rm(previewRecord(loaded.paths), { force: true })).catch(() => undefined);

  return { ...served, dir, ...(log === undefined ? {} : { log }) };
};

/** The project with the run's approved work in it, made at `dir` afresh: what `run preview` serves. */
export const approvedCopy = async (ctx: RunContext, loaded: LoadedRun, dir: string): Promise<void> => {
  await fs.rm(dir, { recursive: true, force: true });
  const approved = (await readApproved(loaded.paths)).files;
  const keep = new Set(Object.keys(approved));
  await cloneFiles(
    ctx.root,
    dir,
    (await projectFiles(ctx.root)).filter(file => isCopied(file, keep))
  );
  for (const [file, entry] of Object.entries(approved)) {
    await placeVersion(loaded.paths, under(dir, file), entry.digest, dir);
  }

  // What a project needs to run that the run never copies: its public files (served as they are) and its settings.
  for (const file of (await projectFiles(ctx.root)).filter(each => !isCopied(each, keep))) {
    await fs.mkdir(path.dirname(under(dir, file)), { recursive: true });
    await fs.copyFile(under(ctx.root, file), under(dir, file), fs.constants.COPYFILE_FICLONE);
  }
};

/**
 * The run's approved work as a folder of the caller's, made afresh — under its scratch unless named, inside the project
 * where its packages resolve, its state its own. A run's scout, told to measure on the run's work, rebuilt it by hand
 * from approved.json and the blobs to keep its suite off the project's state.
 */
export const copyRunWork = async (
  ctx: RunContext,
  runId: string,
  asked?: string
): Promise<{ dir: string; files: number }> => {
  const loaded = await loadRun(ctx, runId, { anyMachine: true });
  const dir = path.resolve(ctx.root, asked ?? path.join(agentScratch(loaded.paths, ctx.agent), 'run-copy'));
  const inside = path.relative(ctx.root, dir);
  if (inside === '' || inside.startsWith('..') || path.isAbsolute(inside)) {
    throw new RunRefusal(
      'invalid',
      `${dir} is not inside the project: the copy's packages would not resolve there — leave it out (your scratch) or name a folder under ${ctx.root}`
    );
  }

  await approvedCopy(ctx, loaded, dir);
  await fs.writeFile(path.join(dir, RUN_COPY_MARK), `${JSON.stringify({ run: runId, at: ctx.now().toISOString() })}\n`);

  return { dir, files: Object.keys((await readApproved(loaded.paths)).files).length };
};

/**
 * The run as it is without `taskId` — its approved work — served on `port` for a look that compares the task's copy
 * with what it changes: what a designer built by hand, a folder copied and two servers started, to say what the task
 * moved and that nothing else did (a run's design-1, twenty steps a review). In the task's cache: gone with it.
 */
export const startBeforePreview = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  port: number
): Promise<Omit<Preview, 'dir'>> => {
  const loaded = await loadRun(ctx, runId, { anyVersion: true });
  const task = loaded.tasks.find(each => each.id === taskId);
  if (!task) {
    throw new RunRefusal('not-found', `Run "${runId}" has no task "${taskId}"`, { task: taskId });
  }

  const { cache } = taskPaths(loaded.paths, taskId);
  const dir = path.join(cache, 'before');
  // The run before it is the same until something is approved: served once, kept for the next look — the designer's,
  // then the lead's — rather than copied and started again each time (2 s of every look).
  const keptIn = path.join(cache, 'before-kept');
  await fs.mkdir(keptIn, { recursive: true });
  const approvedNow = createHash('sha256')
    .update(JSON.stringify(digestsOf(await readApproved(loaded.paths))))
    .digest('hex');
  const approvedFile = path.join(keptIn, 'approved');
  const kept =
    (await readOptional(approvedFile))?.toString('utf-8') === approvedNow ? await keptServer(dir, keptIn) : undefined;
  if (kept !== undefined) {
    const keptPort = Number(new URL(kept).port);

    return { ...borrow(kept, () => touchKept(keptIn, keptPort)), borrowed: { port: keptPort, by: 'kept' } };
  }

  await approvedCopy(ctx, loaded, dir);
  await fs.writeFile(approvedFile, approvedNow);
  if (!canLinger()) {
    return serve(ctx, loaded, dir, port, undefined, { quiet: true, log: path.join(cache, 'before-server.log') });
  }

  const served = await serveCopy(dir, ctx.root, keptIn, { again: 'look again' });
  if ('problem' in served) {
    throw new RunRefusal('invalid', `The run before ${taskId} could not be served: ${served.problem}`, {
      task: taskId
    });
  }

  const pid = served.keep();
  if (pid !== undefined) {
    await keepServer(dir, keptIn, pid, served.port);
  }

  return { ...borrow(served.url, () => touchKept(keptIn, served.port)), borrowed: { port: served.port, by: 'kept' } };
};

/** Where a task's copy is worth serving: being worked — its agent looking at its own pages — or in review. */
export const SERVED_STATUSES: readonly string[] = ['in-progress', 'changes-requested', 'in-review'];

/**
 * Why a copy served for a look does not answer — none once it does: its server stopped, with the error it stopped on
 * and where it logs, as soon as it stops. A run's look waited a minute twice and said only "did not answer", its
 * server dead in a second on the copy's state another held.
 */
export const notServed = async (preview: Preview): Promise<string | undefined> => {
  const up = await Promise.race([answering(preview.url, 60_000), preview.done.then(() => false)]);
  if (up) {
    return undefined;
  }

  const ended = preview.stopped();
  const log = preview.log === undefined ? '' : ` — its log: ${preview.log}`;

  return ended
    ? `was not served: its server stopped before it answered on ${preview.url} — ${failedWhy(ended.said) ?? ended.why}${log}`
    : `did not answer on ${preview.url} within a minute${log}`;
};

/** A look's own state, empty: made again for each cold look, so nothing of the one before is read. */
const coldState = async (cache: string): Promise<string> => {
  const dir = path.join(cache, 'look-state');
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });

  return dir;
};

/**
 * `plitzi run preview --task`: a task's copy served on `port` — in review, as it went there, what the lead looks at
 * before approving it; being worked, as its agent writes it, what it looks at as it goes (no `npm start` of its own in
 * the copy, which holds the copy's kv and a port). Read only. Ends when the task is neither.
 */
export const startTaskPreview = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  port: number,
  /**
   * `cold`: served from a cold start, never a server already on the copy — what it keeps apart from the copy's own, so it
   * runs beside one: a look set beside the run before it compares like with like — the run before is served cold, and
   * a run's looks read a task's copy, warm with its agent's state, as having "moved" where its data had.
   */
  options: { quiet?: boolean; cold?: boolean } = {}
): Promise<Preview> => {
  const loaded = await loadRun(ctx, runId, { anyVersion: true });
  const task = loaded.tasks.find(each => each.id === taskId);
  if (!task) {
    throw new RunRefusal('not-found', `Run "${runId}" has no task "${taskId}"`, { task: taskId });
  }

  const view = await viewTask(loaded.paths, task);
  if (!SERVED_STATUSES.includes(view.state.status)) {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}" is ${view.state.status}: a task's copy is previewed while it is worked or in review (run preview shows what is approved)`,
      { task: taskId }
    );
  }

  const { cache } = taskPaths(loaded.paths, taskId);
  const { cold = false, ...serving } = options;
  // Its agent's own server, left running: it holds the copy's state (its kv lock), so a second one would not start —
  // looked at where it is, and left as it was. A cold look starts its own, apart.
  const running = cold ? undefined : await ownServer(view.paths.work);
  if (running !== undefined) {
    return {
      ...borrow(`http://127.0.0.1:${String(running)}`),
      dir: view.paths.work,
      borrowed: { port: running, by: 'agent' }
    };
  }

  // One a picture of the copy kept (`lingering.ts`) serves it already: a second server beside it would fight it over
  // the copy's state, and one of them fail — a run's lead look pictured nothing. Followed, its use marked.
  const kept = cold ? undefined : await keptServer(view.paths.work, cache);
  if (kept !== undefined) {
    const keptPort = Number(new URL(kept).port);

    return {
      ...borrow(kept, () => touchKept(cache, keptPort)),
      dir: view.paths.work,
      borrowed: { port: keptPort, by: 'kept' }
    };
  }

  const served = await serve(
    ctx,
    loaded,
    view.paths.work,
    port,
    async () => {
      const now = (await viewTask(loaded.paths, task)).state.status;

      return SERVED_STATUSES.includes(now) ? undefined : `the preview stopped: ${taskId} is ${now} now`;
    },
    {
      ...serving,
      log: previewServerLog(cache),
      ...(cold ? { stateDir: await coldState(cache) } : {})
    }
  );
  // Said where a picture in the copy asks for its server: it uses this one, never starts a second.
  await markPreviewed(cache, port);
  void served.done.then(() => unmarkPreviewed(cache)).catch(() => undefined);

  return { ...served, dir: view.paths.work };
};
