import type { JobQueue } from '../../types';
import type { Job } from '@plitzi/sdk-shared';

/** Why a worker takes a job later, not never: handed back "not now", or held back from claiming. */

/**
 * Refusals that mean "not now" rather than "not ever".
 *
 * Both are the cluster protecting itself — another run holds the single-flight key, or this replica is already
 * carrying as much as it will — and neither says anything about the job. So the job goes back to the queue with
 * its attempt REFUNDED: burning one would let a busy afternoon retire a nightly digest as dead.
 */
export const TRY_AGAIN = new Set(['duplicate', 'over_capacity']);

/**
 * Why a job was handed back "not now", in the words its line in the queue says — again in a second or two. Short and
 * plain: it is read beside every waiting job of a burst; which ceiling (`concurrency.perSpace`, the worker's own) is the
 * docs' to say, not every line's.
 */
export const NOT_NOW_WORDS: Partial<Record<string, string>> = {
  over_capacity: 'Waiting for a free slot',
  duplicate: 'Waiting for the same run to finish'
};

/**
 * How soon a job refused "not now" comes round again: a slot of its space frees in seconds, not the half minute and more
 * a failure's backoff waits — a burst's jobs refused at their space's ceiling each waited 30–60 s for nothing.
 */
export const tryAgainMs = (): number => 1_000 + Math.floor(Math.random() * 1_000);

/**
 * How many of its runs may wait for a functions runner with room before a worker claims no more: a job it claimed then
 * waited beside them, held as running — under a load probe, 430 runs held by two workers while their two runners ran 26,
 * every one past its share of the queue's order. Held back, what waits waits in the queue, where every worker sees it,
 * and a worker takes more as soon as a runner takes one of its own (the queue's notice, `wake`, starts it at once).
 */
const RUNNER_WAITING_MOST = 10;

/** Why a worker claims no more for now — its runs waiting for a runner with room — or nothing. */
export const runnersFull = (waiting: number): string | undefined =>
  waiting >= RUNNER_WAITING_MOST
    ? `${String(RUNNER_WAITING_MOST)} or more of its runs wait for a functions runner with room: it takes no more until a runner takes one`
    : undefined;

/** Whether a job needs a functions runner: a function's job, or an action marked as running the space's code. */
const needsRunner = (job: Job): boolean => job.target.kind === 'function' || job.target.code === true;

/**
 * A worker's claims for one look: every job that needs no runner as its slots allow, and of those that do no more than
 * its runs waiting for one leave room for (`RUNNER_WAITING_MOST`). One claim of every free slot took 160 jobs of space
 * code at once — before any of them reached a runner to be counted as waiting — and held them as running beside the
 * runners' 36; with the room spent, it takes only what needs none (`withoutCode`), and a burst's 20 ms actions run on.
 */
export const claimsWithin = (queue: JobQueue, waiting: number) => {
  let room = Math.max(0, RUNNER_WAITING_MOST - waiting);

  return async (claim: Parameters<JobQueue['claim']>[0]): Promise<Job[]> => {
    if (claim.limit <= 0) {
      return [];
    }

    if (room >= claim.limit) {
      const jobs = await queue.claim(claim);
      room -= jobs.filter(needsRunner).length;

      return jobs;
    }

    const light = await queue.claim({ ...claim, withoutCode: true });
    const more = Math.min(room, claim.limit - light.length);
    const heavy = more > 0 ? await queue.claim({ ...claim, limit: more }) : [];
    room -= heavy.filter(needsRunner).length;

    return [...light, ...heavy];
  };
};
