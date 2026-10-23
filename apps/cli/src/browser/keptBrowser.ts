import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';
import { PROJECT_TMP } from '@plitzi/sdk-shared/project';

import { copyOf } from '../runs/paths';

import type { Scheme } from './index';
import type { Measured } from '../commands/measureValues';
import type { Outline } from '../commands/outline';
import type { ElementState } from '../commands/play';
import type { ActingStep } from '../commands/shot/steps';

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

/** The other page as a visitor sees it: where, at what width and in which scheme. */
export interface KeptView {
  url: string;
  width: number;
  height: number;
  scheme?: Scheme;
  /** Its motion held still — what a measure reads — or played, as a visitor's play sees it. */
  reducedMotion?: boolean;
}

/** What a command asks of it: the other page, as a visitor at this width and scheme sees it, and what to read on it. */
export interface KeptAsk extends KeptView {
  /** The other page's elements, as `page measure` names them. */
  targets: string[];
  /** Loaded again, never read as it stood. */
  fresh?: boolean;
  /**
   * Read in a state — elements hovered, focused or clicked in turn first — on a page of its own, never one others read:
   * a state left on a kept page would be the next reader's.
   */
  state?: { kind: 'hover' | 'focus' | 'click'; targets: string[] };
}

/** An outline of the other page — what a click opened, or one part — read on a page of its own. */
export interface KeptOutlineAsk extends KeptView {
  /** Clicked first, in order: what they opened is outlined alone unless a part is named. */
  clicks?: string[];
  within?: string;
  depth: number;
  limit: number;
  words: number;
}

export type KeptOutlineAnswer = { outline: Omit<Outline, 'url' | 'width'> } | { problem: string };

/** Its answer: each element as `measureOn` reads it, in the order asked — or why the page could not be read. */
export type KeptAnswer = { readings: (Measured | { problem: string })[] } | { problem: string };

const isAnswer = (value: unknown): value is KeptAnswer =>
  isRecord(value) && (Array.isArray(value.readings) || typeof value.problem === 'string');

/** A request to the kept browser at one of its routes, its answer read whole, or nothing past `ASK_MS`. */
const ask = <T>(
  port: number,
  route: string,
  body: unknown,
  is: (value: unknown) => value is T
): Promise<T | undefined> =>
  new Promise(resolve => {
    const request = http.request(
      { host: '127.0.0.1', port, path: route, method: 'POST', headers: { 'content-type': 'application/json' } },
      response => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => (text += chunk));
        response.on('end', () => {
          try {
            const value: unknown = JSON.parse(text);
            resolve(is(value) ? value : undefined);
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

  return record ? ask(record.port, '/measure', asked, isAnswer) : undefined;
};

/** The kept browser's port — started for it if none runs — or nothing where none can be kept. */
const keptPort = async (root: string): Promise<number | undefined> => {
  if (keepingOff()) {
    return undefined;
  }

  return ((await readRecord(root)) ?? (await startKept(root)))?.port;
};

const isOutlineAnswer = (value: unknown): value is KeptOutlineAnswer =>
  isRecord(value) &&
  (typeof value.problem === 'string' || (isRecord(value.outline) && Array.isArray(value.outline.elements)));

/** The other page outlined in the kept browser, warm, on a page of its own — or nothing, for the caller to read it. */
export const keptOutline = async (root: string, asked: KeptOutlineAsk): Promise<KeptOutlineAnswer | undefined> => {
  const port = await keptPort(root);

  return port === undefined ? undefined : ask(port, '/outline', asked, isOutlineAnswer);
};

/**
 * A page of the other site held in the kept browser for one command's steps — `page play`'s other side — acted on and
 * read there, step by step; closed by `close`, or by the kept browser once unused a minute.
 */
export interface KeptSession {
  act: (step: ActingStep, index: number) => Promise<{ problem: string } | undefined>;
  read: (targets: readonly string[]) => Promise<(ElementState | { problem: string })[] | { problem: string }>;
  close: () => Promise<void>;
}

const isOpened = (value: unknown): value is { session: string } | { problem: string } =>
  isRecord(value) && (typeof value.session === 'string' || typeof value.problem === 'string');

const isActed = (value: unknown): value is { done: true } | { problem: string } =>
  isRecord(value) && (value.done === true || typeof value.problem === 'string');

const isRead = (value: unknown): value is { states: (ElementState | { problem: string })[] } | { problem: string } =>
  isRecord(value) && (Array.isArray(value.states) || typeof value.problem === 'string');

/**
 * The other page opened warm in the kept browser for a play — or nothing: none can be kept, or it did not answer, and
 * the caller opens the page itself. A page that does not answer there says so (`problem`), as a page opened here would.
 */
export const keptSession = async (
  root: string,
  view: KeptView
): Promise<KeptSession | { problem: string } | undefined> => {
  const port = await keptPort(root);
  const opened = port === undefined ? undefined : await ask(port, '/session/open', view, isOpened);
  if (port === undefined || opened === undefined) {
    return undefined;
  }

  if ('problem' in opened) {
    return opened;
  }

  const { session } = opened;

  return {
    act: async (step, index) => {
      const acted = await ask(port, '/session/act', { session, step, index }, isActed);

      return acted === undefined
        ? { problem: 'the kept browser did not answer' }
        : 'problem' in acted
          ? acted
          : undefined;
    },
    read: async targets => {
      const read = await ask(port, '/session/read', { session, targets }, isRead);

      return read === undefined
        ? { problem: 'the kept browser did not answer' }
        : 'problem' in read
          ? read
          : read.states;
    },
    close: async () => {
      await ask(port, '/session/close', { session }, isActed);
    }
  };
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
