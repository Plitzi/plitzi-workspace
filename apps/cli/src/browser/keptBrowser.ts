import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';
import { PROJECT_TMP } from '@plitzi/sdk-shared/project';

import { copyOf } from '../runs/paths';

import type { Scheme } from './index';
import type { Measured } from '../commands/measureValues';

/**
 * A browser kept open between `page measure` calls, the other site's pages loaded in it: a call that reads an element
 * of the other page not read before asks it, and it reads that page as it already is — rather than launching a browser
 * and loading the page again, most of a reading of another site (lx-controls: 6 s a call, about 1 s once kept).
 *
 * It measures itself (`measureKeeper.ts`), answering over HTTP on this machine alone: a command attached to its pages
 * over the DevTools protocol reset their emulated colour scheme for every other reader — so none attaches, and what is
 * read in parallel is read in one process, which loads each page once, holds what is being read, and closes only what
 * nobody reads. It never outlives its use: 5 minutes unused, an hour whatever happens, its record gone or another's,
 * and a run's end (`stopKeptBrowser`) each stop it. Anything amiss and the caller reads the other page as before.
 */

/** Where the kept browser says how to reach it: in the project's cache, the run's copies sharing their project's. */
const RECORD = path.join(PROJECT_TMP, 'plitzi-cache', 'kept-browser.json');

/** How long a command waits for one it, or another, started to answer. */
export const START_MS = 10_000;

/** The longest a command waits for an answer: a page loaded and read, with time to spare. */
const ASK_MS = 90_000;

const PAUSE_MS = 100;

export interface KeptRecord {
  /** Where it answers, on 127.0.0.1. */
  port: number;
  pid: number;
}

const isKeptRecord = (value: unknown): value is KeptRecord =>
  isRecord(value) && typeof value.port === 'number' && typeof value.pid === 'number';

export const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** Whether a process is alive: one that ended leaves a record pointing at nothing, read as no browser kept. */
const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

/** The record, in the cache of the project — a task's copy's project, never the copy: a run's agents share one. */
export const recordOf = (root: string): string => path.join(copyOf(root)?.root ?? root, RECORD);

export const readRecordFile = async (file: string): Promise<KeptRecord | undefined> => {
  try {
    const value: unknown = JSON.parse(await readFile(file, 'utf8'));

    return isKeptRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

/** The record of a kept browser that runs: one whose process is gone is none. */
const readRecord = async (root: string): Promise<KeptRecord | undefined> => {
  const record = await readRecordFile(recordOf(root));

  return record && alive(record.pid) ? record : undefined;
};

/** Written whole or not at all: a command reading it while it is written never reads half of it. */
export const writeWhole = async (file: string, text: string): Promise<void> => {
  await mkdir(path.dirname(file), { recursive: true });
  const partial = `${file}.${String(process.pid)}.partial`;
  await writeFile(partial, text);
  await rename(partial, file);
};

/**
 * Kept out of tests — a process left beside a test run is one nobody stops — unless a test asks for it
 * (`PLITZI_KEEP_BROWSER=1`), and wherever a person says so (`=0`).
 */
const keepingOff = (): boolean =>
  process.env.PLITZI_KEEP_BROWSER === '0' ||
  (process.env.VITEST !== undefined && process.env.PLITZI_KEEP_BROWSER !== '1');

/** A lock of one: written by whoever is first, taken over once older than `ageMs` — one that died left it. */
const takeLock = async (file: string, ageMs: number): Promise<boolean> => {
  await mkdir(path.dirname(file), { recursive: true });
  try {
    await writeFile(file, String(process.pid), { flag: 'wx' });

    return true;
  } catch {
    const at = await stat(file).then(
      found => found.mtimeMs,
      () => 0
    );
    if (Date.now() - at < ageMs) {
      return false;
    }

    // Old: removed and taken again — two takers race on the `wx`, never both win.
    await rm(file, { force: true });

    return writeFile(file, String(process.pid), { flag: 'wx' }).then(
      () => true,
      () => false
    );
  }
};

/**
 * Starts one, as a process of its own that outlives this command, and waits for its record — or, another command
 * starting one already (its lock written), waits for that one's: measures at once start one browser, not several.
 */
const startKept = async (root: string): Promise<KeptRecord | undefined> => {
  const bin = process.argv.at(1);
  if (bin === undefined) {
    return undefined;
  }

  const lock = `${recordOf(root)}.starting`;
  const first = await takeLock(lock, START_MS);
  if (first) {
    spawn(process.execPath, [bin, 'page', 'keep-browser', '--root', root], { detached: true, stdio: 'ignore' }).unref();
  }

  try {
    const until = Date.now() + START_MS;
    while (Date.now() < until) {
      const record = await readRecord(root);
      if (record) {
        return record;
      }

      await pause(PAUSE_MS);
    }

    return undefined;
  } finally {
    if (first) {
      await rm(lock, { force: true });
    }
  }
};

/** What a command asks of it: the other page, as a visitor at this width and scheme sees it, and what to read on it. */
export interface KeptAsk {
  url: string;
  width: number;
  height: number;
  scheme?: Scheme;
  /** The other page's elements, as `page measure` names them. */
  targets: string[];
  /** Loaded again, never read as it stood. */
  fresh?: boolean;
}

/** Its answer: each element as `measureOn` reads it, in the order asked — or why the page could not be read. */
export type KeptAnswer = { readings: (Measured | { problem: string })[] } | { problem: string };

const isAnswer = (value: unknown): value is KeptAnswer =>
  isRecord(value) && (Array.isArray(value.readings) || typeof value.problem === 'string');

/** A request to the kept browser, its answer read whole, or nothing past `ASK_MS`. */
const ask = (port: number, body: KeptAsk): Promise<KeptAnswer | undefined> =>
  new Promise(resolve => {
    const request = http.request(
      { host: '127.0.0.1', port, path: '/measure', method: 'POST', headers: { 'content-type': 'application/json' } },
      response => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => (text += chunk));
        response.on('end', () => {
          try {
            const value: unknown = JSON.parse(text);
            resolve(isAnswer(value) ? value : undefined);
          } catch {
            resolve(undefined);
          }
        });
      }
    );
    request.setTimeout(ASK_MS, () => {
      request.destroy();
      resolve(undefined);
    });
    request.on('error', () => resolve(undefined));
    request.end(JSON.stringify(body));
  });

/**
 * The other page's elements read in the kept browser — started for it if none runs — or nothing where none can be
 * kept or it did not answer, for the caller to read them as before.
 */
export const keptMeasure = async (root: string, asked: KeptAsk): Promise<KeptAnswer | undefined> => {
  if (keepingOff()) {
    return undefined;
  }

  const record = (await readRecord(root)) ?? (await startKept(root));

  return record ? ask(record.port, asked) : undefined;
};

/** Stops the project's kept browser, if one runs: what a run's end does, so none outlives it. */
export const stopKeptBrowser = async (root: string): Promise<boolean> => {
  const record = await readRecord(root);
  await rm(recordOf(root), { force: true });
  if (!record) {
    return false;
  }

  try {
    process.kill(record.pid, 'SIGTERM');

    return true;
  } catch {
    return false;
  }
};
