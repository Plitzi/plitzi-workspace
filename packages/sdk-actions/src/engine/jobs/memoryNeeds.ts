import type { Job } from '@plitzi/sdk-shared';

/**
 * What a job needs once the worker running it died, in the words every store writes: the in-process ones through
 * `queueRules`, Mongo and MySQL in their own queries — each composing the same sentences from these parts.
 *
 * A worker dies for many reasons — a node lost, a deploy past its grace — and the job is simply run again. But one that
 * died near its memory (it said so: `heartbeat`'s `nearMemoryLimit`), or a second in a row to die running the same job,
 * was taken down by the job: run again on the same size, it ends that one too, and the next. That job needs more than
 * the worker could hold, when the claims say what their workers may (`JobClaimMemory`).
 */

/** What the history says of an attempt nobody reported. */
export const LOST_ERROR = 'the worker holding this job stopped reporting';

/** {@link lostError}'s words around what the worker could hold. */
export const LOST_MEMORY_WORDS = [
  `${LOST_ERROR} near its memory — it could hold `,
  ' MiB, so the job runs next on a worker that may hold more'
] as const;

/** {@link setAsideError}'s words around what the job needs more than, and what the largest worker may hold. */
export const SET_ASIDE_WORDS = [
  'Set aside: a worker died running it — it needs more than ',
  ' MiB, and the largest worker here may hold ',
  ' MiB. Give a worker more memory, then resume it.'
] as const;

/** Whether the job took its worker down: it neared its memory holding it, or the attempt before was lost too. */
export const outgrewWorker = (job: Pick<Job, 'nearMemoryLimit' | 'history'>): boolean =>
  job.nearMemoryLimit === true || job.history.at(-1)?.status === 'lost';

/** The least a job needs after the worker holding it died: more than that one could hold when the job took it down. */
export const needsAfterLoss = (
  needsMb: number | undefined,
  holderMb: number | undefined,
  outgrew: boolean
): number | undefined => (holderMb === undefined || !outgrew ? needsMb : Math.max(needsMb ?? 0, holderMb + 1));

/** Why a job waits after its worker died: for a larger one, when it took that worker down and it said its size. */
export const lostError = (holderMb: number | undefined, outgrew: boolean): string =>
  holderMb === undefined || !outgrew ? LOST_ERROR : `${LOST_MEMORY_WORDS[0]}${String(holderMb)}${LOST_MEMORY_WORDS[1]}`;

/** Why a job is set aside: no worker of the deployment may hold what it needs. */
export const setAsideError = (needsMb: number, ceilingMb: number): string =>
  `${SET_ASIDE_WORDS[0]}${String(needsMb - 1)}${SET_ASIDE_WORDS[1]}${String(ceilingMb)}${SET_ASIDE_WORDS[2]}`;
