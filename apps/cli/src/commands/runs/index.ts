/**
 * `plitzi run` and `plitzi task`: several agents on one project, each in a copy of it, merged once by a
 * person. Every command answers `--json` for a harness and leaves a distinct exit code per refusal (`runs/refusal.ts`);
 * a person's command asks them to type the run's name in their own terminal, and is refused anywhere else.
 */

export type { RunCommandOptions } from './shell';
export { runAllowFinish, runAmend, runExtend, runOpen, runPlan, runRehearse, runSettle } from './plan';
export type { PlanOptions } from './plan';
export { runTeam, runTeamSet, runTeamUnset } from './team';
export { runMonitor } from './monitor';
export { runUpgrade } from './upgrade';
export type { UpgradeRunOptions } from './upgrade';
export { runBench, runCopy, runKeep, runPreview, runReport, runShow, runStatus, runWatch } from './watch';
export type { PreviewOptions, ShowOptions, WatchRunOptions } from './watch';
export {
  runAbort,
  runAttach,
  runCanWrite,
  runContinue,
  runFinish,
  runPurge,
  runRelease,
  runResolve,
  runRestore,
  runResume,
  runStop
} from './lifecycle';
export type { FinishOptions } from './lifecycle';
export { taskNext, taskTake } from './next';
export { claimCommand, taskClaim, taskClaims, taskDiscard, taskRequest } from './files';
export type { ClaimOptions } from './files';
export { taskBlock, taskCheck, taskComplete, taskFound, taskNote, taskProgress, taskUnblock } from './work';
export { taskReassign, taskRevert } from './reassign';
export { taskEscalate } from './escalate';
export { taskReview } from './review';
export { taskLook } from './taskLook';
export { taskShow } from './show';
export type { LookOptions } from './lookOptions';
export type { ReviewOptions } from './review';
export { taskContextCommand } from './brief';
export { spaceImpact, spaceOverview } from './space';
export {
  runBacklog,
  runFeedback,
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
export { runLook } from './runLook';
