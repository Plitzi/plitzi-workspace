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
};

export type FileKv = ActionKvAdapter & {
  /** Resolves once everything written so far is on disk: for a shutdown, or a test that reads the file. */
  flush: () => Promise<void>;
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
 * createServer({ action: { kv: createFileKv({ file: 'data/kv.json' }) } });
 * ```
 *
 * The rules are the in-process store's, to the letter (`createMapKv`): the file is only where the map is kept. Every
 * change is written whole, through a temporary file renamed over the old one, as soon as the change is made — changes
 * that arrive while a write is under way are written together right after it, so a crash loses at most the writes
 * of that instant and never leaves half a file. Entries past their lifetime are not written.
 *
 * ONE process: it reads the file when it starts and owns it after. Two processes on one file overwrite each other —
 * replicas, or a server started with `workers`, use `createSqliteKv` (`@plitzi/sdk-server/sqlite`) or a database.
 * And a whole file per change: right for what a site keeps, not for a counter bumped thousands of times a second.
 */
export const createFileKv = ({ file }: FileKvOptions): FileKv => {
  const entries = load(file);
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

  return {
    ...createMapKv(entries, changed),
    flush: async () => {
      failed = false;
      // Until nothing is pending: a write can follow the one awaited, for a change that arrived as it finished.
      while (writing !== undefined || dirty) {
        if (!(await (writing ?? write()))) {
          throw new Error(`createFileKv: ${file} could not be written; the reason is in the log.`);
        }
      }
    }
  };
};
