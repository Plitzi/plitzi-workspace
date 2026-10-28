import fs from 'node:fs';

import { documentOf, stateOf } from './queueDocument';
import { applyRule, changedBy, emptyState, queueOver, queueRules } from './queueRules';
import { documentWriter, holdFile, letGo } from '../../../helpers/fileStore';

import type { QueueState } from './queueRules';
import type { JobQueue } from '@plitzi/sdk-shared';

export type FileJobQueueOptions = {
  /** The JSON file the queue lives in — created, with its folder, on the first change. */
  file: string;
  /** Who holds it, said to a second process that tries: `the server of "acme", on port 8080`. */
  owner?: string;
  /** Where the process that holds it answers, for a second one to be pointed there: `http://localhost:8080`. */
  serves?: string;
  /** How many finished jobs to keep before the oldest are dropped. Default 500. */
  retainFinished?: number;
  /** What the queue calls now, in epoch ms. */
  clock?: () => number;
};

export type FileJobQueue = JobQueue & {
  /** Resolves once everything changed so far is on disk: for a shutdown, or a test that reads the file. */
  flush: () => Promise<void>;
  /** Writes what is pending and lets go of the file, for the next process to take. */
  close: () => Promise<void>;
};

const load = (file: string): QueueState => {
  if (!fs.existsSync(file)) {
    return emptyState();
  }

  const refuse = (why: string) =>
    new Error(
      `createFileJobQueue: ${file} is not a queue it wrote (${why}). Move it aside, or point \`file\` elsewhere.`
    );
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw refuse(error instanceof Error ? error.message : String(error));
  }

  const state = stateOf(parsed);
  if (typeof state === 'string') {
    throw refuse(state);
  }

  return state;
};

/**
 * The job queue in one JSON file: what `ctx.later`, a schedule's fires and a function's jobs wait in, surviving a
 * restart — for a deployment with no database. A job due while the server was down runs once it is back; one a worker
 * held when it went down is taken again, its attempt written `lost`.
 *
 * ```ts
 * createServer({ action: { jobs: { queue: createFileJobQueue({ file: 'state/jobs.json' }) } } });
 * ```
 *
 * The rules are the in-process queue's, to the letter (`queueRules`): the file is only where its state is kept, written
 * whole after each change that changed something, as `createFileKv` writes its own. ONE process holds the file
 * (`<file>.lock`); the workers of one server reach the primary's through the fleet (`fleetJobQueue`); replicas share
 * `createSqliteJobQueue` (`@plitzi/sdk-server/sqlite`) or a database's queue.
 */
export const createFileJobQueue = ({
  file,
  owner,
  serves,
  retainFinished = 500,
  clock = Date.now
}: FileJobQueueOptions): FileJobQueue => {
  const lock = holdFile(file, { owner, serves }, 'createFileJobQueue');
  let state: QueueState;
  try {
    state = load(file);
  } catch (error) {
    letGo(lock);
    throw error;
  }

  const rules = queueRules(state, { retainFinished, clock });
  const { changed, flush } = documentWriter({
    file,
    document: () => `${JSON.stringify(documentOf(state), null, 2)}\n`,
    store: 'createFileJobQueue',
    what: 'job queue file'
  });

  return {
    ...queueOver((method, args) => {
      const answer = applyRule(rules, method, args);
      if (changedBy(method, answer)) {
        changed();
      }

      return Promise.resolve(answer);
    }),
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
