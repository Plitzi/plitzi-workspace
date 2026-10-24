import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';
import { LATER_ANSWER_FILE, LATER_ASK_FILE } from '@plitzi/sdk-shared/project';

import type { Job, JobQueue } from '@plitzi/sdk-shared';

/**
 * `plitzi functions later` while the project is served: what waits to run later (`ctx.later`), and one of them started
 * now. The server holds its queue's file, so the CLI asks it through a file of the project's `tmp/` and reads the answer
 * beside it — a spec of a show that starts in five minutes waited the five, every pass (encore-3's test-1, ~6 min each).
 * Only while developing: a deployment's queue is an operator's (`createJobControl`).
 */

/** A run set for later, as the CLI says it. */
export type LaterWaiting = { job: string; action: string; key?: string; dueAt: number };

export type LaterAsk = { id: string; ask: 'list' } | { id: string; ask: 'now'; key: string };

export type LaterAnswer =
  { id: string; waiting: LaterWaiting[] } | { id: string; started: LaterWaiting } | { id: string; problem: string };

const said = (job: Job): LaterWaiting => ({
  job: job.id,
  action: job.target.name,
  ...(job.key === undefined ? {} : { key: job.key }),
  dueAt: job.dueAt
});

const waitingOf = async (queue: JobQueue, spaceId: number): Promise<Job[]> =>
  (await queue.listJobs({ spaceIds: [spaceId], status: 'pending', kind: 'action', limit: 500, offset: 0 })).jobs.filter(
    job => job.target.kind === 'action' && job.target.trigger === 'later'
  );

/**
 * Answers one ask. Started now, a run set for later is set again under its key, due now — `ctx.later`'s own rule
 * replaces the one waiting — so the worker takes it at its next look, as it would have at its time.
 */
export const answerLaterAsk = async (queue: JobQueue, spaceId: number, ask: LaterAsk): Promise<LaterAnswer> => {
  const waiting = await waitingOf(queue, spaceId);
  if (ask.ask === 'list') {
    return { id: ask.id, waiting: waiting.map(said) };
  }

  const job = waiting.find(each => each.key === ask.key);
  if (!job) {
    const keys = waiting.flatMap(each => (each.key === undefined ? [] : [each.key]));

    return {
      id: ask.id,
      problem: `Nothing waits to run later under "${ask.key}"${keys.length > 0 ? `: what waits is ${keys.join(', ')}` : ': nothing waits at all'}`
    };
  }

  const now = (await queue.now()).getTime();
  const id = `${job.id}:now:${String(now)}`;
  await queue.enqueue({
    id,
    spaceId,
    environment: job.environment,
    target: job.target,
    input: job.input,
    dueAt: now,
    maxAttempts: job.maxAttempts,
    key: ask.key
  });
  await queue.cancelPending({ spaceId, key: ask.key, olderThan: id });

  return { id: ask.id, started: { ...said(job), job: id, dueAt: now } };
};

const askOf = (value: unknown): LaterAsk | undefined => {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return undefined;
  }

  if (value.ask === 'list') {
    return { id: value.id, ask: 'list' };
  }

  return value.ask === 'now' && typeof value.key === 'string'
    ? { id: value.id, ask: 'now', key: value.key }
    : undefined;
};

/** Looks for an ask every so often and answers it: what stops looking. */
export const watchLaterAsks = (
  root: string,
  queue: () => JobQueue | undefined,
  spaceId: number,
  { everyMs = 500 }: { everyMs?: number } = {}
): (() => void) => {
  const asked = path.join(root, LATER_ASK_FILE);
  const answered = path.join(root, LATER_ANSWER_FILE);
  let busy = false;
  const answer = (said: LaterAnswer): void => {
    const writing = `${answered}.${String(process.pid)}`;
    writeFileSync(writing, JSON.stringify(said));
    renameSync(writing, answered);
  };
  const look = async (): Promise<void> => {
    if (busy || !existsSync(asked)) {
      return;
    }

    busy = true;
    let ask: LaterAsk | undefined;
    try {
      ask = askOf(JSON.parse(readFileSync(asked, 'utf-8')));
      rmSync(asked, { force: true });
      if (ask === undefined) {
        return;
      }

      const jobs = queue();
      answer(
        jobs === undefined
          ? { id: ask.id, problem: 'This server runs no jobs: its actions have no queue (`action.jobs: false`)' }
          : await answerLaterAsk(jobs, spaceId, ask)
      );
    } catch (error) {
      // What could not be answered is said to the asker, never dropped; an ask that cannot be read is removed.
      rmSync(asked, { force: true });
      if (ask !== undefined) {
        answer({ id: ask.id, problem: error instanceof Error ? error.message : String(error) });
      }
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => {
    void look().catch((error: unknown) => {
      console.warn(`[later] an ask of plitzi functions later went unanswered: ${String(error)}`);
    });
  }, everyMs);
  timer.unref();

  return () => clearInterval(timer);
};
