import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { isSecretFile, NOT_COPIED_DIRS, SERVED_DIRS, under } from './paths';
import { RunRefusal } from './refusal';
import { digest } from '../commands/spaceOrigin';
import { isTextFile } from '../scaffold/fromSpace';

/**
 * The run's file primitives: every write atomic (a temp file beside it, then a rename), every claim exclusive (`wx`, the
 * first wins), every read of a run's file checked against what it must hold. Exclusive creation and the rename are
 * atomic on macOS and Linux; on Windows a rename over a file another process holds open fails with
 * EPERM/EBUSY for a moment, so it is tried again before it fails.
 */

const TRANSIENT = new Set(['EPERM', 'EBUSY', 'EACCES']);
const RENAME_TRIES = 8;

const codeOf = (error: unknown): string | undefined =>
  error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : undefined;

const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const renameRetrying = async (from: string, to: string): Promise<void> => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await fs.rename(from, to);

      return;
    } catch (error) {
      const code = codeOf(error);
      if (code === undefined || !TRANSIENT.has(code) || attempt >= RENAME_TRIES) {
        throw error;
      }

      await pause(25 * 2 ** attempt);
    }
  }
};

/** Writes `file` whole or not at all: a reader sees the old bytes or the new ones, never half. */
export const writeAtomic = async (file: string, bytes: string | Uint8Array): Promise<void> => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    await fs.writeFile(temp, bytes);
    await renameRetrying(temp, file);
  } catch (error) {
    await fs.rm(temp, { force: true });
    throw error;
  }
};

export const writeJson = (file: string, value: unknown): Promise<void> =>
  writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`);

/** Creates `file` only if nothing is there: true for the one caller that made it, false for every other. */
export const createExclusive = async (file: string, bytes: string): Promise<boolean> => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    const handle = await fs.open(file, 'wx');
    try {
      await handle.writeFile(bytes);
    } finally {
      await handle.close();
    }

    return true;
  } catch (error) {
    if (codeOf(error) === 'EEXIST') {
      return false;
    }

    throw error;
  }
};

export const exists = (file: string): Promise<boolean> =>
  fs.access(file).then(
    () => true,
    () => false
  );

/**
 * A file's bytes, or undefined when there is no file there — nothing at all, or a folder: a plan's unit that is a folder
 * not made yet (a plugin's) is backed up as a path, and once the run makes it, it is a folder of files the run approves
 * one by one, never read as one file (the preview's sync read src/plugins/TierList and stopped the approval).
 */
export const readOptional = async (file: string): Promise<Buffer | undefined> => {
  try {
    return await fs.readFile(file);
  } catch (error) {
    if (codeOf(error) === 'ENOENT' || codeOf(error) === 'EISDIR') {
      return undefined;
    }

    throw error;
  }
};

/**
 * A run's JSON file, held to what it must be: undefined when it is not there, refused naming the file when it holds
 * something else — a run's files are the CLI's, and one changed by hand is said, never read as if it were right.
 */
export const readJson = async <T>(
  file: string,
  guard: (value: unknown) => value is T,
  what: string,
  /** What a file an earlier CLI wrote reads as now, before it is held to `guard`: a run opened before keeps working. */
  upgrade: (value: unknown) => unknown = value => value
): Promise<T | undefined> => {
  const bytes = await readOptional(file);
  if (bytes === undefined) {
    return undefined;
  }

  // Written only by the CLI, a temp file renamed over it: a broken one was edited by hand — said, never guessed past.
  const broken = (said: string): RunRefusal =>
    new RunRefusal('invalid', `${file} ${said}: it was changed outside the CLI, and nothing is done on a guess`, {
      file,
      next: 'put back what was changed in it; if that cannot be, a person aborts the run (plitzi run abort) — the project is as it was, its files backed up when the run opened'
    });
  let parsed: unknown;
  try {
    parsed = upgrade(JSON.parse(bytes.toString('utf-8')));
  } catch {
    throw broken(`is not JSON — it should hold ${what}`);
  }

  if (!guard(parsed)) {
    throw broken(`does not hold ${what}`);
  }

  return parsed;
};

/** A file's fingerprint, or null when there is none — a file that does not exist is a state like any other. */
export const fingerprint = async (file: string): Promise<string | null> => {
  const bytes = await readOptional(file);

  return bytes === undefined ? null : digest(bytes);
};

const inServedDir = (file: string): boolean => SERVED_DIRS.some(dir => file === dir || file.startsWith(`${dir}/`));

/** Whether a project file is part of what a task's copy holds — `keep` names the binaries a task owns. */
export const isCopied = (file: string, keep: ReadonlySet<string>): boolean =>
  !isSecretFile(file) && (keep.has(file) || !inServedDir(file) || isTextFile(file));

/** The project's files a copy can hold, by project path, sorted: what is not the source and what is secret left out. */
export const projectFiles = async (root: string): Promise<string[]> => {
  const found: string[] = [];
  const walk = async (dir: string, prefix: string): Promise<void> => {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!NOT_COPIED_DIRS.has(relative) && entry.name !== 'node_modules') {
          await walk(path.join(dir, entry.name), relative);
        }
      } else if (entry.isFile() && !isSecretFile(relative)) {
        found.push(relative);
      }
    }
  };
  await walk(root, '');

  return found.sort();
};

/**
 * Clones `files` from `from` into `to` — copy-on-write where the disk can (APFS, btrfs), a plain copy elsewhere — and
 * answers each one's fingerprint. A file that is not there is answered as null and not written.
 */
export const cloneFiles = async (
  from: string,
  to: string,
  files: readonly string[]
): Promise<Record<string, string | null>> => {
  const fingerprints: Record<string, string | null> = {};
  for (const file of files) {
    const source = under(from, file);
    const target = under(to, file);
    const bytes = await readOptional(source);
    if (bytes === undefined) {
      fingerprints[file] = null;
      continue;
    }

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target, fs.constants.COPYFILE_FICLONE);
    fingerprints[file] = digest(bytes);
  }

  return fingerprints;
};

/**
 * Clones `files` — served binaries a task does not own — from `from` into `to`, copy-on-write, unread: answers each by
 * its size and time in the copy, what a change of it is told by.
 */
export const cloneServed = async (
  from: string,
  to: string,
  files: readonly string[]
): Promise<Record<string, { size: number; mtimeMs: number }>> => {
  const cloned: Record<string, { size: number; mtimeMs: number }> = {};
  for (const file of files) {
    const target = under(to, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const done = await fs.copyFile(under(from, file), target, fs.constants.COPYFILE_FICLONE).then(
      () => true,
      () => false
    );
    if (done) {
      const stat = await fs.stat(target);
      cloned[file] = { size: stat.size, mtimeMs: stat.mtimeMs };
    }
  }

  return cloned;
};

/** Every file under `dir`, as paths relative to it with forward slashes. */
export const filesUnder = async (dir: string): Promise<string[]> => {
  const found: string[] = [];
  const walk = async (at: string, prefix: string): Promise<void> => {
    const entries = await fs.readdir(at, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(path.join(at, entry.name), relative);
      } else if (entry.isFile()) {
        found.push(relative);
      }
    }
  };
  await walk(dir, '');

  return found.sort();
};

/** The latest time any of `files` under `dir` was written: a working copy's own signal of life. */
export const newestWrite = async (dir: string, files: readonly string[]): Promise<number | undefined> => {
  let newest: number | undefined;
  for (const file of files) {
    const stat = await fs.stat(under(dir, file)).catch(() => undefined);
    if (stat && (newest === undefined || stat.mtimeMs > newest)) {
      newest = stat.mtimeMs;
    }
  }

  return newest;
};

/** The bytes a folder holds, every file under it: what a sweep weighs caches by. */
export const sizeOf = async (dir: string): Promise<number> => {
  let total = 0;
  for (const file of await filesUnder(dir)) {
    const stat = await fs.stat(under(dir, file)).catch(() => undefined);
    total += stat?.size ?? 0;
  }

  return total;
};
