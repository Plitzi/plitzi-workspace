/**
 * `plitzi run` and `plitzi task`: several agents on one project, each in a copy of it, merged once by a
 * person. Every command answers `--json` for a harness and leaves a distinct exit code per refusal (`runs/refusal.ts`);
 * a person's command asks them to type the run's name in their own terminal, and is refused anywhere else.
 */

export type { RunCommandOptions } from './shell';
export { runAllowFinish, runAmend, runExtend, runNote, runOpen, runPlan, runRehearse } from './plan';
export type { PlanOptions } from './plan';
export { runTeam, runTeamCheck, runTeamSet, runTeamUnset } from './team';
export { runMonitor } from './monitor';
export { runUpgrade } from './upgrade';
export type { UpgradeRunOptions } from './upgrade';
export { runBench, runPending, runPreview, runReport, runShow, runState, runStatus, runWatch } from './watch';
export type { WatchRunOptions } from './watch';
export {
  runAbort,
  runAttach,
  runCanWrite,
  runContinue,
  runFinish,
  runPrune,
  runPurge,
  runRelease,
  runResolve,
  runRestore,
  runResume,
  runStop
} from './lifecycle';
export type { FinishOptions } from './lifecycle';
export { taskNext, taskTake } from './next';
export { taskClaim, taskClaims, taskDiscard, taskRelease, taskRequest, taskSpike, taskWait } from './files';
export { taskBlock, taskCheck, taskComplete, taskNote, taskProgress, taskUnblock } from './work';
export { taskLook, taskReassign, taskRevert, taskReview, taskShow } from './review';
export type { LookOptions, ReviewOptions } from './review';
export { taskContextCommand } from './brief';
export { spaceImpact, spaceOverview } from './space';
export {
  runBacklog,
  runNotice,
  taskAnswer,
  taskAsk,
  taskInbox,
  taskMessage,
  taskProposals,
  taskPropose,
  taskTell
} from './talk';
export type { AnswerOptions, ProposeOptions } from './talk';
export { runReference } from './reference';
export type { ReferenceOptions } from './reference';
