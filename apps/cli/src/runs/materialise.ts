import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { cloneFiles, isCopied, projectFiles } from './files';
import { under } from './paths';
import { placeVersion } from './store';

import type { CheckResult } from './checks';
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

/** The project's checks over the project with `versions` in it, the folder removed after. */
export const checkVersions = async (
  ctx: RunContext,
  loaded: LoadedRun,
  versions: Record<string, string | null>
): Promise<CheckResult> => {
  const dir = await materialise(ctx, loaded, versions);
  try {
    return await ctx.checks(dir, ctx.root);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};
