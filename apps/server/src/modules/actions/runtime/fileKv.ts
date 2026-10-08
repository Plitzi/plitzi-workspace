import fs from 'node:fs';
import path from 'node:path';

import { createMapKv } from './memoryKv';
import { writeFileAtomic } from '../../../helpers/atomicFile';
import { serverLog } from '../../../helpers/serverLog';

import type { KvEntry } from './memoryKv';
import type { ActionKvAdapter } from '../types';

export type FileKvOptions = {
  /** The JSON file the store lives in — created, with its folder, on the first write. */
  file: string;
  /** Who holds it, said to a second process that tries: `this project's server, on port 8080`. */
  owner?: string;
};

export type FileKv = ActionKvAdapter & {
  /** Resolves once everything written so far is on disk: for a shutdown, or a test that reads the file. */
  flush: () => Promise<void>;
  /** Writes what is pending and lets go of the file, for the next process to take. */
  close: () => Promise<void>;
};

/** Who holds a file: written beside it (`<file>.lock`) while a process has it. */
type Holder = { pid: number; since: string; owner?: string };

const holderIn = (lock: string): Holder | undefined => {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(lock, 'utf8'));

    return typeof parsed === 'object' && parsed !== null && 'pid' in parsed && typeof parsed.pid === 'number'
      ? {
          pid: parsed.pid,
          since: 'since' in parsed && typeof parsed.since === 'string' ? parsed.since : '?',
          ...('owner' in parsed && typeof parsed.owner === 'string' ? { owner: parsed.owner } : {})
        }
      : undefined;
  } catch {
    return undefined;
  }
};

/** Whether a process is still running: signal 0 asks without sending anything, and `EPERM` is one that is not ours. */
const running = (pid: number): boolean => {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

/** The files this process holds, let go of together when it exits — however it does. */
const held = new Set<string>();
const letGo = (lock: string): void => {
  held.delete(lock);
  if (holderIn(lock)?.pid === process.pid) {
    fs.rmSync(lock, { force: true });
  }
};

process.once('exit', () => held.forEach(letGo));

/**
 * Takes the file for this process, or says who has it.
 *
 * Two processes on one file each load it and then write their whole map over it: every change one makes, the other
 * erases with its next write, and nothing anywhere says so — a second server started beside the first, a `--watch`
 * left running after a restart. So a file has one holder: a second is refused, naming the first. A lock whose process is
 * gone — killed, crashed — is taken over.
 */
const take = (file: string, owner: string | undefined): string => {
  const lock = `${file}.lock`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const mine: Holder = { pid: process.pid, since: new Date().toISOString(), ...(owner ? { owner } : {}) };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      fs.writeFileSync(lock, JSON.stringify(mine), { flag: 'wx' });
      held.add(lock);

      return lock;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }

      const holder = holderIn(lock);
      if (holder && running(holder.pid)) {
        throw new Error(
          `createFileKv: ${file} is in use by process ${String(holder.pid)}${holder.owner ? ` — ${holder.owner}` : ''}, since ${holder.since}. Two processes on one file write over each other's changes: stop that one first, or point \`file\` elsewhere.`,
          { cause: error }
        );
      }

      fs.rmSync(lock, { force: true });
    }
  }

  throw new Error(`createFileKv: ${lock} could not be taken`);
};

/** What the file holds, versioned so a later layout can tell an old file from a broken one. */
type FileKvDocument = { format: 1; entries: Record<string, KvEntry> };

const isEntry = (value: unknown): value is KvEntry =>
  typeof value === 'object' &&
  value !== null &&
  'value' in value &&
  typeof value.value === 'string' &&
  (!('expiresAt' in value) || typeof value.expiresAt === 'number');

const load = (file: string): Map<string, KvEntry> => {
  if (!fs.existsSync(file)) {
    return new Map();
  }

  const refuse = (why: string) =>
    new Error(`createFileKv: ${file} is not a store it wrote (${why}). Move it aside, or point \`file\` elsewhere.`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw refuse(error instanceof Error ? error.message : String(error));
  }

  if (typeof parsed !== 'object' || parsed === null || !('format' in parsed) || parsed.format !== 1) {
    throw refuse('no `format: 1`');
  }

  const entries = 'entries' in parsed && typeof parsed.entries === 'object' ? parsed.entries : null;
  if (entries === null) {
    throw refuse('no `entries`');
  }

  const now = Date.now();
  const kept = Object.entries(entries).filter(
    (pair): pair is [string, KvEntry] =>
      isEntry(pair[1]) && (pair[1].expiresAt === undefined || pair[1].expiresAt > now)
  );

  return new Map(kept);
};

/**
 * A key/value store in one JSON file: the `kv` server actions keep — saved layouts, counters, a source's cached answer —
 * surviving a restart, for a deployment with no database. Nothing to install, and a file anybody can read, back up or
 * edit by hand while the server is stopped.
 *
 * ```ts
 * createServer({ action: { kv: createFileKv({ file: 'state/kv.json' }) } });
 * ```
 *
 * The rules are the in-process store's, to the letter (`createMapKv`): the file is only where the map is kept. Every
 * change is written whole, through a temporary file renamed over the old one, as soon as the change is made — changes
 * that arrive while a write is under way are written together right after it, so a crash loses at most the writes
 * of that instant and never leaves half a file. Entries past their lifetime are not written.
 *
 * ONE process: it reads the file when it starts and holds it after (`<file>.lock`, with its pid) — a second process is
 * refused, naming the first, because two would write over each other's changes. The workers of one server reach the
 * primary's through the fleet (`fleetKv`); replicas use `createSqliteKv` (`@plitzi/sdk-server/sqlite`) or a database.
 * And a whole file per change: right for what a site keeps, not for a counter bumped thousands of times a second.
 */
export const createFileKv = ({ file, owner }: FileKvOptions): FileKv => {
  const lock = take(file, owner);
  let entries: Map<string, KvEntry>;
  try {
    entries = load(file);
  } catch (error) {
    letGo(lock);
    throw error;
  }

  let dirty = false;
  // A write that failed is retried by the next change or `flush`, not in a loop against a disk that keeps refusing.
  let failed = false;
  /** The write under way, resolving to whether everything it took on reached the disk. */
  let writing: Promise<boolean> | undefined;

  const document = (): string => {
    const now = Date.now();
    const live = [...entries].filter(([, entry]) => entry.expiresAt === undefined || entry.expiresAt > now);
    const body: FileKvDocument = { format: 1, entries: Object.fromEntries(live) };

    return `${JSON.stringify(body, null, 2)}\n`;
  };

  const drain = async (): Promise<boolean> => {
    while (dirty) {
      dirty = false;
      try {
        await fs.promises.mkdir(path.dirname(file), { recursive: true });
        await writeFileAtomic(file, document());
      } catch (error) {
        // Kept dirty: the next change, or `flush`, tries again rather than losing what this one carried.
        dirty = true;
        failed = true;
        serverLog.error('Actions', `kv file ${file} could not be written`, error);

        return false;
      }
    }

    return true;
  };

  const write = (): Promise<boolean> => {
    writing ??= new Promise<void>(resolve => {
      // A microtask later, so the writes made together — a list's item and its index — become one file write.
      queueMicrotask(resolve);
    })
      .then(drain)
      .finally(() => {
        writing = undefined;
        // A change that landed after the loop's last look and before this: it is written now, not with the next one.
        if (dirty && !failed) {
          void write();
        }
      });

    return writing;
  };

  const changed = () => {
    dirty = true;
    failed = false;
    void write();
  };

  const flush = async (): Promise<void> => {
    failed = false;
    // Until nothing is pending: a write can follow the one awaited, for a change that arrived as it finished.
    while (writing !== undefined || dirty) {
      if (!(await (writing ?? write()))) {
        throw new Error(`createFileKv: ${file} could not be written; the reason is in the log.`);
      }
    }
  };

  return {
    ...createMapKv(entries, changed),
    flush,
    close: async () => {
      try {
        await flush();
      } finally {
        letGo(lock);
      }
    }
  };
};
