import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { checkAcceptance } from './acceptance';
import { cloneFiles, cloneServed, fingerprint, isCopied, projectFiles, readOptional, writeJson } from './files';
import { isSecretFile, under } from './paths';
import { placeVersion } from './store';

import type { CheckOptions, CheckResult } from './checks';
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
  const all = await projectFiles(ctx.root);
  await cloneFiles(
    ctx.root,
    dir,
    all.filter(file => isCopied(file, keep))
  );
  // The pictures the pages draw, as a task's copy has them: without them every check of a page with one failed on its
  // 404 — la-velada's finish, on the artists' photos in public/.
  await cloneServed(
    ctx.root,
    dir,
    all.filter(file => !isSecretFile(file) && !isCopied(file, keep))
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
    .update(JSON.stringify([prints.sort(([a], [b]) => a.localeCompare(b)), placed, await toolsKey(ctx.root)]))
    .digest('hex');
};

/**
 * The Plitzi the checks run with, as it is installed: each `@plitzi` package and when its manifest and its build were
 * written. An install writes them again whatever the version says — velada-now's upgrade put new code under the same
 * 0.38.24, and the finish said its checks "as they did on this same result, not run again".
 */
const toolsKey = async (root: string): Promise<[string, number, number][]> => {
  const scope = path.join(root, 'node_modules', '@plitzi');
  const names = (await fs.readdir(scope).catch(() => [])).filter(name => !name.startsWith('.')).sort();
  const writtenAt = (file: string) =>
    fs.stat(file).then(
      stat => stat.mtimeMs,
      () => 0
    );

  return Promise.all(
    names.map(async (name): Promise<[string, number, number]> => [
      name,
      await writtenAt(path.join(scope, name, 'package.json')),
      await writtenAt(path.join(scope, name, 'dist'))
    ])
  );
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
  versions: Record<string, string | null>,
  { final = false }: CheckOptions = {}
): Promise<CheckResult> => {
  const key = `${await treeKey(ctx, versions)}${final ? '-final' : ''}`;
  // In the run's cache: `run prune` may take it, and a pass not kept is only run again.
  const keptAt = path.join(loaded.paths.cache, 'checks', `${key}.json`);
  const kept = await readOptional(keptAt);
  const parsed: unknown = kept === undefined ? undefined : parseKept(kept);
  if (isKept(parsed) && ctx.now().getTime() - Date.parse(parsed.at) < KEPT_MS) {
    return { ...parsed.result, reused: parsed.at };
  }

  const dir = await materialise(ctx, loaded, versions);
  try {
    const result = await ctx.checks(dir, ctx.root, { final });
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
): Promise<{ results: AcceptanceAgain[]; reused?: string; kept?: number }> => {
  if (lines.length === 0) {
    return { results: [] };
  }

  // Kept line by line: on the same result, a line that passed has nothing new to tell, and the next finish runs only
  // the ones that did not — a whole set run again for one line a CDN was slow on asked the CDN the same thousands of
  // images again, and failed on another (la-velada).
  const tree = await treeKey(ctx, versions);
  const keptAt = (line: { check: string }) =>
    path.join(
      loaded.paths.cache,
      'acceptance',
      `${createHash('sha256')
        .update(JSON.stringify([tree, line.check]))
        .digest('hex')}.json`
    );
  const keptSince = async (line: { check: string }): Promise<string | undefined> => {
    const kept = await readOptional(keptAt(line));
    const parsed: unknown = kept === undefined ? undefined : parseKept(kept);

    return isRecord(parsed) && typeof parsed.at === 'string' && ctx.now().getTime() - Date.parse(parsed.at) < KEPT_MS
      ? parsed.at
      : undefined;
  };
  const since = await Promise.all(lines.map(keptSince));
  const toRun = lines.filter((_, index) => since[index] === undefined);
  const reused = since.filter((at): at is string => at !== undefined).sort()[0];
  if (toRun.length === 0) {
    return { results: lines.map(line => ({ ...line, ok: true })), ...(reused ? { reused } : {}) };
  }

  const dir = await materialise(ctx, loaded, versions);
  try {
    const answered = await checkAcceptance(
      toRun.map(line => ({ said: line.said, check: line.check })),
      { work: dir, root: ctx.root, cache: loaded.paths.cache }
    );
    const ran = new Map(toRun.map((line, index) => [line, { ...answered[index], task: line.task }] as const));
    for (const [line, result] of ran) {
      if (result.ok) {
        await writeJson(keptAt(line), { at: ctx.now().toISOString() });
      }
    }

    const kept = lines.length - toRun.length;

    return { results: lines.map(line => ran.get(line) ?? { ...line, ok: true }), ...(kept > 0 ? { kept } : {}) };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};
