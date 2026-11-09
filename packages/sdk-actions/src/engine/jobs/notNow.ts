import type { JobQueue, JobTake } from '../../types';
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
 * How long from `now` — the queue's clock, which every instant of it is read by — until the next minute begins, and a
 * moment more: when a budget over the minute may be spent again.
 */
export const msToNextMinute = (now: number): number => 60_000 - (now % 60_000) + Math.floor(Math.random() * 5_000);

/**
 * How soon a job refused "not now" comes round again: a slot of its space frees in seconds, not the half minute and more
 * a failure's backoff waits — a burst's jobs refused at their space's ceiling each waited 30–60 s for nothing.
 */
export const tryAgainMs = (): number => 1_000 + Math.floor(Math.random() * 1_000);

/**
 * How many of its runs may wait for a functions runner with room before a worker claims no more: a job it claimed then
 * waited beside them, held as running — under a load probe, 430 runs held by two workers while their two runners ran 26,
 * every one past its share of the queue's order. Held back, what waits waits in the queue, where every worker sees it,
 * and a worker takes more on its next look: as one of its jobs ends, a job is queued (`wake`), or `pollMs` passes.
 */
const RUNNER_WAITING_MOST = 10;

/** Why a worker claims no more for now — its runs waiting for a runner with room — or nothing. */
export const runnersFull = (waiting: number): string | undefined =>
  waiting >= RUNNER_WAITING_MOST
    ? `${String(RUNNER_WAITING_MOST)} or more of its runs wait for a functions runner with room: it takes no more until a runner takes one`
    : undefined;

/**
 * A worker's claims for one look. Of the jobs that need a runner, no more than its runs waiting for one leave room for
 * (`RUNNER_WAITING_MOST`) — one claim of every free slot took 160 jobs of space code at once, before any reached a runner
 * to be counted — shared by turns between their two kinds, the actions that run code and the functions' jobs: half the
 * room each, the first of them `turn`'s (alternated look by look), what one leaves the other takes. They are offered
 * their room first, and every job that needs none (`light`) the slots left: taken in the queue's order, a burst's
 * actions held 100 minute-long jobs back for two and a half minutes, and light jobs first, a steady flow of them would
 * have held both kinds back for ever.
 */
export const claimsWithin = (queue: JobQueue, waiting: number, turn: 'codeActions' | 'functionJobs') => {
  let room = Math.max(0, RUNNER_WAITING_MOST - waiting);
  const order: JobTake[] = turn === 'codeActions' ? ['codeActions', 'functionJobs'] : ['functionJobs', 'codeActions'];

  return async (claim: Parameters<JobQueue['claim']>[0]): Promise<Job[]> => {
    if (claim.limit <= 0) {
      return [];
    }

    const taken: Job[] = [];
    const share = async (takes: JobTake, limit: number): Promise<void> => {
      const left = Math.min(limit, room, claim.limit - taken.length);
      if (left > 0) {
        const jobs = await queue.claim({ ...claim, takes, limit: left });
        room -= jobs.length;
        taken.push(...jobs);
      }
    };
    await share(order[0] ?? 'codeActions', Math.ceil(room / 2));
    await share(order[1] ?? 'functionJobs', room);
    await share(order[0] ?? 'codeActions', room);
    if (claim.limit > taken.length) {
      taken.push(...(await queue.claim({ ...claim, takes: 'light', limit: claim.limit - taken.length })));
    }

    return taken;
  };
};
