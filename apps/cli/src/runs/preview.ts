import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseEnv } from 'node:util';

import { isRecord } from '@plitzi/sdk-shared/helpers';
import { RUN_STATUS_ENV } from '@plitzi/sdk-shared/runs';

import {
  cloneFiles,
  fingerprint,
  isCopied,
  projectFiles,
  readJson,
  readOptional,
  writeAtomic,
  writeJson
} from './files';
import { under } from './paths';
import { stopTree } from './processes';
import { RunRefusal } from './refusal';
import { loadRun, readApproved, readBase, readRecord, requireNoTask } from './run';
import { placeVersion } from './store';
import { viewTask } from './taskStore';
import { viewRun } from './view';
import { scriptsOf } from '../commands/verify';

import type { LoadedRun, RunContext } from './run';
import type { RunView } from './view';
import type { RunSnapshot } from '@plitzi/sdk-shared/runs';

/**
 * The run's work as it goes: the project with every approved task over it, served by the project's own dev
 * server in the run's cache — what is connected shows the moment it is approved, not only at the final merge. Each
 * approval puts its files into it, and the dev server swaps them in. Never the project itself: its files stay as they
 * are until the final merge. The `.env` is read from the project and handed to the server, never copied into the run.
 */

const previewDir = (loaded: LoadedRun): string => path.join(loaded.paths.cache, 'preview');
const previewRecord = (loaded: LoadedRun): string => path.join(loaded.paths.cache, 'preview.json');
/** The run as the preview's page shows it in its dev tools (`RUN_STATUS_PATH`), written as it goes. */
const snapshotFile = (loaded: LoadedRun): string => path.join(loaded.paths.cache, 'preview-run.json');

/** The run's view, as the dev tools read it (`RunSnapshot`): what a person looking at the page wants of the run. */
export const snapshotOf = (view: RunView, at: Date): RunSnapshot => ({
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
    ...(task.reviewer ? { reviewer: task.reviewer } : {}),
    round: task.round,
    files: task.files,
    ...(task.step ? { step: task.step } : {}),
    ...(task.fraction !== undefined ? { fraction: task.fraction } : {})
  })),
  attention: view.attention.map(item => ({ text: item.text, who: item.who }))
});

const writeSnapshot = async (ctx: RunContext, loaded: LoadedRun): Promise<void> => {
  const view = await viewRun(ctx, loaded.record.runId);
  await writeAtomic(snapshotFile(loaded), `${JSON.stringify(snapshotOf(view, ctx.now()))}\n`);
};

const isPreview = (value: unknown): value is { pid: number; port: number } =>
  isRecord(value) && typeof value.pid === 'number' && typeof value.port === 'number';

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

/** The port of the run's preview while one serves it — none running, undefined. */
export const previewPort = async (loaded: LoadedRun): Promise<number | undefined> => {
  const running = await readJson(previewRecord(loaded), isPreview, 'a run’s preview').catch(() => undefined);

  return running && alive(running.pid) ? running.port : undefined;
};

/** Puts the run's approved work into a running preview — none running, nothing done. Answers whether it did. */
export const syncPreview = async (loaded: LoadedRun, root: string): Promise<boolean> => {
  const running = await readJson(previewRecord(loaded), isPreview, 'a run’s preview').catch(() => undefined);
  if (!running || !alive(running.pid)) {
    return false;
  }

  const dir = previewDir(loaded);
  const approved = (await readApproved(loaded.paths)).files;
  for (const [file, entry] of Object.entries(approved)) {
    // Only what changed is written: every write is a reload in the open page.
    if ((await fingerprint(under(dir, file))) !== entry.digest) {
      await placeVersion(loaded.paths, under(dir, file), entry.digest);
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
  { quiet = false, snapshot = false }: { quiet?: boolean; snapshot?: boolean } = {}
): Promise<Omit<Preview, 'dir'>> => {
  const scripts = await scriptsOf(dir);
  const script = scripts['start:dev'] ? 'start:dev' : scripts.start ? 'start' : undefined;
  if (!script) {
    throw new RunRefusal('invalid', 'The project has no start or start:dev script to serve the run’s work with');
  }

  const env = (await readOptional(path.join(ctx.root, '.env')))?.toString('utf-8');
  const child = spawn(scripts[script], {
    cwd: dir,
    shell: true,
    // Quiet for a command that says its own findings (`task look`): the server's start lines are not its answer.
    stdio: quiet ? 'ignore' : 'inherit',
    env: {
      ...process.env,
      ...(env ? parseEnv(env) : {}),
      PORT: String(port),
      ...(snapshot ? { [RUN_STATUS_ENV]: snapshotFile(loaded) } : {}),
      PATH: `${path.join(ctx.root, 'node_modules', '.bin')}${path.delimiter}${process.env.PATH ?? ''}`
    }
  });

  let why: string | undefined;
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
      resolve(why === undefined ? { code: code ?? 1, why: `the server stopped (${String(code)})` } : { code: 0, why });
    });
  });

  return { url: `http://127.0.0.1:${String(port)}`, done, stop };
};

/** `plitzi run preview`: the run's work served on `port`, kept up to date until the run ends. */
export const startPreview = async (ctx: RunContext, runId: string, port: number): Promise<Preview> => {
  requireNoTask(ctx, 'preview the run');
  const loaded = await loadRun(ctx, runId, { anyVersion: true });
  const dir = previewDir(loaded);
  await fs.rm(dir, { recursive: true, force: true });
  const approved = (await readApproved(loaded.paths)).files;
  const keep = new Set(Object.keys(approved));
  await cloneFiles(
    ctx.root,
    dir,
    (await projectFiles(ctx.root)).filter(file => isCopied(file, keep))
  );
  for (const [file, entry] of Object.entries(approved)) {
    await placeVersion(loaded.paths, under(dir, file), entry.digest);
  }

  // What a project needs to run that the run never copies: its public files (served as they are) and its settings.
  for (const file of (await projectFiles(ctx.root)).filter(each => !isCopied(each, keep))) {
    await fs.mkdir(path.dirname(under(dir, file)), { recursive: true });
    await fs.copyFile(under(ctx.root, file), under(dir, file), fs.constants.COPYFILE_FICLONE);
  }

  await writeSnapshot(ctx, loaded);
  const served = await serve(ctx, loaded, dir, port, undefined, { snapshot: true });
  await writeJson(previewRecord(loaded), { pid: process.pid, port });
  void served.done.then(() => fs.rm(previewRecord(loaded), { force: true })).catch(() => undefined);

  return { ...served, dir };
};

/**
 * `plitzi run preview --task`: a task's copy as it went to review, served on `port` — what the lead looks at before
 * approving it, not only after. Ends when the task leaves review.
 */
export const startTaskPreview = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  port: number,
  options: { quiet?: boolean } = {}
): Promise<Preview> => {
  requireNoTask(ctx, 'preview a task');
  const loaded = await loadRun(ctx, runId, { anyVersion: true });
  const task = loaded.tasks.find(each => each.id === taskId);
  if (!task) {
    throw new RunRefusal('not-found', `Run "${runId}" has no task "${taskId}"`, { task: taskId });
  }

  const view = await viewTask(loaded.paths, task);
  if (view.state.status !== 'in-review') {
    throw new RunRefusal(
      'invalid',
      `Task "${taskId}" is ${view.state.status}: a task's copy is previewed while it is in review (run preview shows what is approved)`,
      { task: taskId }
    );
  }

  const served = await serve(
    ctx,
    loaded,
    view.paths.work,
    port,
    async () => {
      const now = (await viewTask(loaded.paths, task)).state.status;

      return now === 'in-review' ? undefined : `the preview stopped: ${taskId} is ${now} now`;
    },
    options
  );

  return { ...served, dir: view.paths.work };
};
