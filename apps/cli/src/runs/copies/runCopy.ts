import fs from 'node:fs/promises';
import path from 'node:path';

import { cloneFiles, isCopied, projectFiles } from '../../core/files';
import { agentScratch, RUN_COPY_MARK, under } from '../../core/paths';
import { RunRefusal } from '../../core/refusal';
import { placeVersion } from '../../core/store';
import { loadRun, readApproved } from '../run';

import type { LoadedRun, RunContext } from '../run';

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
