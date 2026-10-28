import fs from 'node:fs';
import path from 'node:path';

import { writeFileAtomic } from './atomicFile';
import { serverLog } from './serverLog';

/**
 * What a store kept in one JSON file needs beside its own rules: the file held by one process, and its document written
 * whole after each change. `createFileKv` and `createFileJobQueue` keep theirs this way.
 */

/**
 * Who holds a file: written beside it (`<file>.lock`) while a process has it — and, for a server, the address it
 * answers at (`serves`), which a second one started beside it is pointed to.
 */
export type FileHolder = { pid: number; since: string; owner?: string; serves?: string };

/** What a process says of itself as it takes a file: who it is, and where it answers. */
export type HolderOf = { owner?: string; serves?: string };

const holderIn = (lock: string): FileHolder | undefined => {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(lock, 'utf8'));

    return typeof parsed === 'object' && parsed !== null && 'pid' in parsed && typeof parsed.pid === 'number'
      ? {
          pid: parsed.pid,
          since: 'since' in parsed && typeof parsed.since === 'string' ? parsed.since : '?',
          ...('owner' in parsed && typeof parsed.owner === 'string' ? { owner: parsed.owner } : {}),
          ...('serves' in parsed && typeof parsed.serves === 'string' ? { serves: parsed.serves } : {})
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

/**
 * A file another running process holds: its message is the whole report — who holds it and how to stop it — said as it
 * is when the server starts (`serveProject`). Thrown plain, it was a stack ending on its cause's `EEXIST`, and the agent
 * reading the end of it found no word of what to do.
 */
export class FileInUseError extends Error {
  /** The process that holds it: a server says where it answers, for the one refused to point there. */
  readonly holder: FileHolder;

  constructor(message: string, holder: FileHolder, options?: ErrorOptions) {
    super(message, options);
    this.name = 'FileInUseError';
    this.holder = holder;
  }
}

/** The files this process holds, let go of together when it exits — however it does. */
const held = new Set<string>();

/** Lets go of a file this process holds. */
export const letGo = (lock: string): void => {
  held.delete(lock);
  if (holderIn(lock)?.pid === process.pid) {
    fs.rmSync(lock, { force: true });
  }
};

process.once('exit', () => held.forEach(letGo));

/**
 * Takes the file for this process, or says who has it — `store` names the store in what is said (`createFileKv`).
 *
 * Two processes on one file each load it and then write their whole document over it: every change one makes, the
 * other erases with its next write, and nothing anywhere says so — a second server started beside the first, a
 * `--watch` left running after a restart. So a file has one holder: a second is refused, naming the first. A lock whose
 * process is gone — killed, crashed — is taken over.
 */
export const holdFile = (file: string, { owner, serves }: HolderOf, store: string): string => {
  const lock = `${file}.lock`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const mine: FileHolder = {
    pid: process.pid,
    since: new Date().toISOString(),
    ...(owner ? { owner } : {}),
    ...(serves ? { serves } : {})
  };
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
        throw new FileInUseError(
          `${store}: ${file} is in use by process ${String(holder.pid)}${holder.owner ? ` — ${holder.owner}` : ''}, since ${holder.since}. Two processes on one file write over each other's changes: stop that one first, or point \`file\` elsewhere.`,
          holder,
          { cause: error }
        );
      }

      fs.rmSync(lock, { force: true });
    }
  }

  throw new Error(`${store}: ${lock} could not be taken`);
};

export type DocumentWriter = {
  /** Says the document changed: it is written as soon as the write under way, if any, is done. */
  changed: () => void;
  /** Resolves once everything changed so far is on disk; rejects when it could not be written. */
  flush: () => Promise<void>;
};

/**
 * Writes `document()` to `file` whole after each change, through a temporary file renamed over the old one — changes
 * that arrive while a write is under way are written together right after it, so a crash loses at most the changes of
 * that instant and never leaves half a file. A write that failed is said in the log and tried again by the next change
 * or `flush`, never in a loop against a disk that keeps refusing.
 */
export const documentWriter = ({
  file,
  document,
  store,
  what
}: {
  file: string;
  document: () => string;
  /** The store, as an error names it: `createFileKv`. */
  store: string;
  /** What the file is, as the log says it: `kv file`. */
  what: string;
}): DocumentWriter => {
  let dirty = false;
  let failed = false;
  /** The write under way, resolving to whether everything it took on reached the disk. */
  let writing: Promise<boolean> | undefined;

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
        serverLog.error('Actions', `${what} ${file} could not be written`, error);

        return false;
      }
    }

    return true;
  };

  const write = (): Promise<boolean> => {
    writing ??= new Promise<void>(resolve => {
      // A microtask later, so the changes made together — a list's item and its index — become one file write.
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

  return {
    changed: () => {
      dirty = true;
      failed = false;
      void write();
    },
    flush: async () => {
      failed = false;
      // Until nothing is pending: a write can follow the one awaited, for a change that arrived as it finished.
      while (writing !== undefined || dirty) {
        if (!(await (writing ?? write()))) {
          throw new Error(`${store}: ${file} could not be written; the reason is in the log.`);
        }
      }
    }
  };
};
