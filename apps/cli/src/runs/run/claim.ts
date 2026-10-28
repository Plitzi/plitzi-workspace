import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { activeRuns, readRecord } from './record';
import { stopPreviewOf } from '../copies/previewRecord';
import { stopListenersUnder } from '../copies/processes';
import { foldersUnsaid } from '../copies/processTable';
import { createExclusive, fingerprint, readOptional } from '../core/files';
import { activeRunFile, runPaths } from '../core/paths';
import { RunRefusal } from '../core/refusal';

import type { RunContext } from './context';
import type { RunRecord } from '../core/model';
import type { RunPaths } from '../core/paths';

/**
 * The project taken by one run at a time (`active.json`), and let go — the run's folder and the inputs it was handed
 * removed with it.
 */

/** How long a run takes to open at most: a claim older than this with no run behind it was cut, and is taken over. */
const CLAIM_GRACE_MS = 2 * 60_000;

const isActiveClaim = (value: unknown): value is { runId: string; since: string; by: string } =>
  isRecord(value) && typeof value.runId === 'string' && typeof value.since === 'string' && typeof value.by === 'string';

/** One run at a time: refused, naming it and how long it has been quiet, when another is going. */
export const assertNoOtherRun = async (ctx: RunContext, except?: string): Promise<void> => {
  const other = (await activeRuns(ctx.root)).find(runId => runId !== except);
  if (!other) {
    return;
  }

  const record = await readRecord(runPaths(ctx.root, other)).catch(() => undefined);
  throw new RunRefusal(
    'another-run',
    `Run "${other}" is going in this project${record ? ` (${record.status}, opened ${record.openedAt})` : ''}: one run at a time — stack the next plan on it (plitzi run open <plan>: one finish for both), finish it (plitzi run finish ${other}), or a person aborts it (plitzi run abort ${other})`,
    { run: other }
  );
};

/**
 * Takes the project for `runId`: `active.json` created exclusively, so of two runs opening at once one wins. One a run
 * no longer has — gone, or never opened — is taken over.
 */
export const claimProject = async (ctx: RunContext, runId: string): Promise<void> => {
  const file = activeRunFile(ctx.root);
  const mine = `${JSON.stringify({ runId, since: ctx.now().toISOString(), by: ctx.agent }, null, 2)}\n`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await createExclusive(file, mine)) {
      return;
    }

    const bytes = await readOptional(file);
    let claim: unknown;
    try {
      claim = bytes === undefined ? undefined : JSON.parse(bytes.toString('utf-8'));
    } catch {
      claim = undefined;
    }

    if (isActiveClaim(claim)) {
      const going = await readRecord(runPaths(ctx.root, claim.runId)).catch(() => undefined);
      // A claim with no run yet is a run still opening — its record is written last — unless it is old: then it was cut.
      const opening = !going && ctx.now().getTime() - Date.parse(claim.since) < CLAIM_GRACE_MS;
      if (going || opening) {
        throw new RunRefusal(
          'another-run',
          `Run "${claim.runId}" is ${going ? 'going' : 'opening'} in this project: one plan and one run at a time`,
          { run: claim.runId }
        );
      }
    }

    // Only the claim as read is taken away: one another run made meanwhile is not.
    const again = await readOptional(file);
    if (again === undefined || bytes === undefined || again.equals(bytes)) {
      await fs.rm(file, { force: true });
    }
  }

  throw new RunRefusal('another-run', `${file} keeps changing: another run is opening — try again in a moment`);
};

/** The project let go: its run is gone. */
export const releaseProject = async (root: string, runId: string): Promise<void> => {
  const file = activeRunFile(root);
  const bytes = await readOptional(file);
  if (bytes === undefined) {
    return;
  }

  let claim: unknown;
  try {
    claim = JSON.parse(bytes.toString('utf-8'));
  } catch {
    claim = undefined;
  }

  if (!isActiveClaim(claim) || claim.runId === runId) {
    await fs.rm(file, { force: true });
  }
};

/**
 * A run gone, its folder with it — backups and every version it kept: once its work is in the project, or once a person
 * aborted it, nothing of it is left behind for anyone to clean up.
 */
export const removeRun = async (ctx: RunContext, paths: RunPaths, runId: string): Promise<RemovedInputs> => {
  const inputs = (await readRecord(paths).catch(() => undefined))?.inputs ?? [];
  await stopPreviewOf(paths);
  // What its agents started in their copies and left listening: stopped before the folders go from under them.
  const servers = stopListenersUnder(paths.dir).map(
    server => `:${String(server.port)} (${path.relative(paths.dir, server.cwd) || '.'})`
  );
  // Retried: an agent's command still ending writes its usage line as the folder goes (ENOTEMPTY). The project is let go
  // whatever happens, so a removal that fails never leaves the next run refused as "another run".
  try {
    await fs.rm(paths.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } finally {
    await releaseProject(ctx.root, runId);
  }

  // The runs' folder with the last of them: the project's tmp/ as the run found it. Another run in it, it stays.
  await fs.rmdir(path.dirname(paths.dir)).catch(() => undefined);

  const unsaid = foldersUnsaid();

  return { ...(await removeInputs(ctx, inputs)), servers, ...(unsaid === undefined ? {} : { serversUnsaid: unsaid }) };
};

export interface RemovedInputs {
  /** The plan and the summary the run was handed, gone with it. */
  removed: string[];
  /** …or kept, changed since the run read them: the lead's to keep or remove. */
  kept: string[];
  /** The servers left listening in its folders, stopped: `:49342 (tasks/t-vs-medal/cache/work)`. */
  servers: string[];
  /** Why they could not be looked for, where the machine does not say a process's folder (Windows). */
  serversUnsaid?: string;
}

/**
 * What the lead handed the run, removed with it when it is as the run read it — and the folders that held only them:
 * no plan, primer or amendment is left lying in the project.
 */
const removeInputs = async (ctx: RunContext, inputs: RunRecord['inputs']): Promise<Omit<RemovedInputs, 'servers'>> => {
  const removed: string[] = [];
  const kept: string[] = [];
  for (const input of inputs) {
    const file = path.resolve(ctx.root, input.file);
    if ((await fingerprint(file)) === input.digest) {
      await fs.rm(file, { force: true });
      removed.push(input.file);
      await removeEmptyFolders(ctx.root, path.dirname(file));
    } else if ((await fingerprint(file)) !== null) {
      kept.push(input.file);
    }
  }

  return { removed, kept };
};

/**
 * What the lead handed the run from inside the project — a plan, its primer — moved into the run's own folder
 * (`inputs/`, or `inputs/<stage>/` for a stage), where the lead edits them for `run amend`: nothing of the run lies in
 * the project's `tmp/` beside it, and they go with it. Files outside the project are the lead's, left where they are.
 * Answers where each went.
 */
export const takeInputs = async (
  ctx: RunContext,
  paths: RunPaths,
  files: readonly (string | undefined)[],
  stage?: string
): Promise<string[]> => {
  const into = path.join(paths.dir, 'inputs', ...(stage ? [stage] : []));
  const moved: string[] = [];
  for (const file of files) {
    const relative = file === undefined ? '..' : path.relative(ctx.root, file);
    if (file === undefined || relative.startsWith('..') || path.isAbsolute(relative) || file.startsWith(paths.dir)) {
      continue;
    }

    const to = path.join(into, path.basename(file));
    await fs.mkdir(into, { recursive: true });
    await fs.rename(file, to);
    moved.push(to);
    await removeEmptyFolders(ctx.root, path.dirname(file));
  }

  return moved;
};

/** `folder` and the ones above it, while empty — never the project's root nor its `tmp/`. */
const removeEmptyFolders = async (root: string, folder: string): Promise<void> => {
  const stops = new Set([path.resolve(root), path.resolve(root, 'tmp')]);
  for (
    let at = path.resolve(folder);
    !stops.has(at) && !path.relative(root, at).startsWith('..');
    at = path.dirname(at)
  ) {
    if ((await fs.readdir(at).catch(() => ['?'])).length > 0) {
      return;
    }

    await fs.rmdir(at).catch(() => undefined);
  }
};

/**
 * The files the lead hands the run — a plan, the primer beside it, an amendment, a stage — as inputs of its record: each
 * by project path and fingerprint, removed with the run when it is still as the run read it.
 */
export const handedInputs = async (
  ctx: RunContext,
  files: readonly (string | undefined)[]
): Promise<RunRecord['inputs']> =>
  (await Promise.all(files.flatMap(file => (file ? [inputOf(ctx, path.resolve(file))] : [])))).filter(
    (input): input is RunRecord['inputs'][number] => input !== undefined
  );

/** `inputs` with `added` in it — a file handed again is the version read last. */
export const withInputs = (inputs: RunRecord['inputs'], added: RunRecord['inputs']): RunRecord['inputs'] => [
  ...inputs.filter(each => !added.some(input => input.file === each.file)),
  ...added
];

/** A file the lead hands the run, by project path when it is in the project: what `removeRun` takes away with it. */
export const inputOf = async (ctx: RunContext, file: string): Promise<RunRecord['inputs'][number] | undefined> => {
  const relative = path.relative(ctx.root, file);
  const digestOf = await fingerprint(file);
  if (relative.startsWith('..') || path.isAbsolute(relative) || digestOf === null) {
    return undefined;
  }

  return { file: relative.split(path.sep).join('/'), digest: digestOf };
};
