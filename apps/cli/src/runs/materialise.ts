import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { checkAcceptance } from './acceptance';
import { cloneFiles, fingerprint, isCopied, projectFiles, readOptional, writeJson } from './files';
import { under } from './paths';
import { placeVersion } from './store';

import type { CheckResult } from './checks';
import type { AcceptanceResult } from './model';
import type { LoadedRun, RunContext } from './run';

/**
 * A copy of the project with `versions` put in it — the run's work, or what a merge would make of it — for the
 * project's checks. Each in a folder of its own under the run's cache, so two checks at once never share one; removed
 * once checked.
 */
export const materialise = async (
  ctx: RunContext,
  loaded: LoadedRun,
  versions: Record<string, string | null>
): Promise<string> => {
  const dir = path.join(loaded.paths.cache, `check-${randomBytes(4).toString('hex')}`);
  const keep = new Set(Object.keys(versions));
  await cloneFiles(
    ctx.root,
    dir,
    (await projectFiles(ctx.root)).filter(file => isCopied(file, keep))
  );
  for (const [file, digest] of Object.entries(versions)) {
    await placeVersion(loaded.paths, under(dir, file), digest);
  }

  return dir;
};

/**
 * How long a pass is kept: the same tree passes the same checks — but a check may read the day (an age, a month's
 * total), so not for ever.
 */
const KEPT_MS = 60 * 60_000;

/** The tree `versions` would make, by content: every file the copy takes, as the project holds it or as `versions` say. */
const treeKey = async (ctx: RunContext, versions: Record<string, string | null>): Promise<string> => {
  const keep = new Set(Object.keys(versions));
  const prints: [string, string | null][] = [];
  for (const file of (await projectFiles(ctx.root)).filter(each => isCopied(each, keep) && !keep.has(each))) {
    prints.push([file, await fingerprint(under(ctx.root, file))]);
  }

  const placed = Object.entries(versions).sort(([a], [b]) => a.localeCompare(b));

  return createHash('sha256')
    .update(JSON.stringify([prints.sort(([a], [b]) => a.localeCompare(b)), placed]))
    .digest('hex');
};

const parseKept = (bytes: Buffer): unknown => {
  try {
    return JSON.parse(bytes.toString('utf-8'));
  } catch {
    return undefined;
  }
};

const isKept = (value: unknown): value is { at: string; result: CheckResult } =>
  isRecord(value) && typeof value.at === 'string' && isRecord(value.result) && value.result.ok === true;

/**
 * The project's checks over the project with `versions` in it, the folder removed after. A pass on the very same tree
 * within the hour is said again rather than run again — the dry run's at `finish --apply`, an approval's at the finish —
 * with when it was found (`reused`).
 */
export const checkVersions = async (
  ctx: RunContext,
  loaded: LoadedRun,
  versions: Record<string, string | null>
): Promise<CheckResult> => {
  const key = await treeKey(ctx, versions);
  // In the run's cache: `run prune` may take it, and a pass not kept is only run again.
  const keptAt = path.join(loaded.paths.cache, 'checks', `${key}.json`);
  const kept = await readOptional(keptAt);
  const parsed: unknown = kept === undefined ? undefined : parseKept(kept);
  if (isKept(parsed) && ctx.now().getTime() - Date.parse(parsed.at) < KEPT_MS) {
    return { ...parsed.result, reused: parsed.at };
  }

  const dir = await materialise(ctx, loaded, versions);
  try {
    const result = await ctx.checks(dir, ctx.root);
    if (result.ok && result.none === undefined) {
      await writeJson(keptAt, { at: ctx.now().toISOString(), result });
    }

    return result;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};

/** One acceptance line of a done task, run again on a whole result: what it answers there. */
export interface AcceptanceAgain extends AcceptanceResult {
  task: string;
}

/**
 * The acceptance lines that passed at each done task's review, run again on the tree `versions` make — the whole
 * result, each task's work beside the others': a line a later task broke fails here, though it passed in its own copy.
 * Served once for all of them; a pass on the very same tree and lines within the hour is said again (`reused`).
 */
export const acceptanceOnResult = async (
  ctx: RunContext,
  loaded: LoadedRun,
  versions: Record<string, string | null>,
  lines: readonly { task: string; said: string; check: string }[]
): Promise<{ results: AcceptanceAgain[]; reused?: string }> => {
  if (lines.length === 0) {
    return { results: [] };
  }

  const key = createHash('sha256')
    .update(JSON.stringify([await treeKey(ctx, versions), lines]))
    .digest('hex');
  const keptAt = path.join(loaded.paths.cache, 'acceptance', `${key}.json`);
  const kept = await readOptional(keptAt);
  const parsed: unknown = kept === undefined ? undefined : parseKept(kept);
  if (isRecord(parsed) && typeof parsed.at === 'string' && ctx.now().getTime() - Date.parse(parsed.at) < KEPT_MS) {
    return { results: lines.map(line => ({ ...line, ok: true })), reused: parsed.at };
  }

  const dir = await materialise(ctx, loaded, versions);
  try {
    const answered = await checkAcceptance(
      lines.map(line => ({ said: line.said, check: line.check })),
      { work: dir, root: ctx.root, cache: loaded.paths.cache }
    );
    const results = answered.map((answer, index) => ({ ...answer, task: lines[index].task }));
    if (results.every(result => result.ok)) {
      await writeJson(keptAt, { at: ctx.now().toISOString() });
    }

    return { results };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};
