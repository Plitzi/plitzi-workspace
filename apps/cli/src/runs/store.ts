import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { createExclusive, exists, readOptional, writeAtomic } from './files';
import { under } from './paths';
import { digest } from '../commands/spaceOrigin';

import type { RunPaths } from './paths';

/**
 * Every version a run keeps, by its fingerprint: the backups, the approved work, each reviewed version and request. A
 * version is written once and never changed, so a manifest that names it is the one commit point — a cut between
 * writing a version and naming it leaves an unnamed file, never a half-written one that is named.
 */
export const putBlob = async (run: RunPaths, bytes: Buffer): Promise<string> => {
  const fingerprint = digest(bytes);
  const file = path.join(run.blobs, fingerprint);
  if (!(await exists(file))) {
    await writeAtomic(file, bytes);
  }

  return fingerprint;
};

export const getBlob = async (run: RunPaths, fingerprint: string): Promise<Buffer> => {
  const bytes = await readOptional(path.join(run.blobs, fingerprint));
  if (bytes === undefined || digest(bytes) !== fingerprint) {
    throw new Error(
      `The run's copy of a version (${fingerprint.slice(0, 12)}) is missing or changed in ${run.blobs}: the run's folder was changed outside the CLI`
    );
  }

  return bytes;
};

/** Keeps `files` of `folder` as blobs, by project path: their fingerprints, null for each that is not there. */
export const keepFiles = async (
  run: RunPaths,
  folder: string,
  files: readonly string[]
): Promise<Record<string, string | null>> => {
  const kept: Record<string, string | null> = {};
  for (const file of files) {
    const bytes = await readOptional(under(folder, file));
    kept[file] = bytes === undefined ? null : await putBlob(run, bytes);
  }

  return kept;
};

/** Writes the version `fingerprint` names at `file` — or removes it, for null. */
export const placeVersion = async (run: RunPaths, file: string, fingerprint: string | null): Promise<void> => {
  if (fingerprint === null) {
    // A folder where no file was (a unit the run made): its files are put back one by one; it goes once it is empty.
    if ((await fs.stat(file).catch(() => undefined))?.isDirectory() === true) {
      await fs.rmdir(file).catch(() => undefined);

      return;
    }

    await fs.rm(file, { force: true });

    return;
  }

  await writeAtomic(file, await getBlob(run, fingerprint));
};

interface HeldLock {
  pid: number;
  machine: string;
  at: string;
}

const isHeldLock = (value: unknown): value is HeldLock =>
  isRecord(value) && typeof value.pid === 'number' && typeof value.machine === 'string' && typeof value.at === 'string';

const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export class LockTimeout extends Error {
  constructor(file: string, held: HeldLock | undefined) {
    super(
      `${file} is held${held ? ` by process ${String(held.pid)} on ${held.machine} since ${held.at}` : ''}: another merge is going on. Try again in a moment.`
    );
    this.name = 'LockTimeout';
  }
}

/**
 * Runs `work` holding `file` — created exclusively, so one holder at a time across processes — and lets it go after.
 * A holder cut before it let go is waited out: a lock older than `ttlMs` is taken over.
 */
export const withLock = async <T>(
  file: string,
  work: () => Promise<T>,
  { ttlMs = 5 * 60_000, waitMs = 30_000, now = (): Date => new Date() } = {}
): Promise<T> => {
  const mine: HeldLock = { pid: process.pid, machine: os.hostname(), at: now().toISOString() };
  const started = Date.now();
  for (;;) {
    if (await createExclusive(file, JSON.stringify(mine))) {
      break;
    }

    const bytes = await readOptional(file);
    let held: HeldLock | undefined;
    try {
      const parsed: unknown = bytes === undefined ? undefined : JSON.parse(bytes.toString('utf-8'));
      held = isHeldLock(parsed) ? parsed : undefined;
    } catch {
      held = undefined;
    }

    const stale = held === undefined || now().getTime() - Date.parse(held.at) > ttlMs;
    if (stale && bytes !== undefined) {
      // Only the lock as read is taken away: one another process made meanwhile is not.
      const again = await readOptional(file);
      if (again !== undefined && again.equals(bytes)) {
        await fs.rm(file, { force: true });
      }

      continue;
    }

    if (Date.now() - started > waitMs) {
      throw new LockTimeout(file, held);
    }

    await pause(40);
  }

  try {
    return await work();
  } finally {
    await fs.rm(file, { force: true });
  }
};
