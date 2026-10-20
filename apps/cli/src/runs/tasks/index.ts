/**
 * What a task does in a run: taken with an exclusive owner, a `.lock` per file and a copy of the
 * project; written only in that copy; completed with its fingerprints compared and the project's checks run in it;
 * reviewed; and, approved, merged into the run's work — never into the project, which only the final merge reaches.
 */

export { cleanPath, findTask, holderOf, holderOrCoordinator, roleOf, withoutSignal } from './common';
export {
  allLocks,
  assertNoWaitCycle,
  canWrite,
  claimFile,
  claims,
  followWait,
  locksOn,
  releaseFile,
  waitForFile
} from './locks';
export type { ClaimOutcome, Followed, HeldFile } from './locks';
export { followNext, nextTask, takeNext } from './next';
export type { NextTask } from './next';
export { takeTask } from './take';
export type { TakenTask } from './take';
export { blockTask, noteTask, reportProgress, unblockTask } from './signals';
export type { Signal } from './signals';
export { completeTask, discardFile } from './complete';
export type { CompleteOptions, CompletedTask } from './complete';
export { requestShared, requestsOf } from './requests';
export { reviewTask } from './review';
export type { ReviewedTask } from './review';
export { reassignTask, revertTask } from './reassign';
export { taskContext } from './context';
export type { TaskContext } from './context';
