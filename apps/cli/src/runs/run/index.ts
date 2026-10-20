/**
 * A run: its folder, its record, and what may be done to it by whom. Every command of `plitzi run` and
 * `plitzi task` goes through `loadRun`, which refuses on the spot what the run's state does not allow — another machine
 * holds it, the Plitzi version changed under it — so no command has to remember to.
 */

export { requireNoTask, requirePerson } from './context';
export type { LoadedRun, PersonGate, RunContext } from './context';
export {
  activeRuns,
  assertStatus,
  loadRun,
  logRun,
  pinnedChanges,
  pinnedNow,
  readApproved,
  readBase,
  readRecord,
  readShared,
  runIds,
  samePinned,
  updateRecord
} from './record';
export type { LoadOptions } from './record';
export { assertNoOtherRun, handedInputs, inputOf, removeRun, withInputs } from './claim';
export type { RemovedInputs } from './claim';
export {
  MAX_PRIMER_BYTES,
  allowLeadFinish,
  checkPlanFile,
  openRun,
  readCheckedPlan,
  readPlanFile,
  primerFile,
  readPrimer
} from './open';
export type { OpenedRun } from './open';
export { attachRun, pruneRuns, purgeRun, recordBrake, releaseRun, resumeRun, stopRun } from './control';
export type { Pruned } from './control';
