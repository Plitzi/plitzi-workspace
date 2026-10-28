/**
 * `plitzi run` and `plitzi task`: several agents on one project, each in a copy of it, merged once by a
 * person. Every command answers `--json` for a harness and leaves a distinct exit code per refusal (`runs/core/refusal.ts`);
 * a person's command asks them to type the run's name in their own terminal, and is refused anywhere else.
 */

export type { RunCommandOptions } from './shell';
export { runAllowFinish, runAmend, runOpen, runPlan, runRehearse, runSettle } from './run/plan';
export type { PlanOptions } from './run/plan';
export { runTeam, runTeamSet, runTeamUnset } from './run/team';
export { runMonitor } from './monitor/monitor';
export { runUpgrade } from './run/upgrade';
export type { UpgradeRunOptions } from './run/upgrade';
export { runBench, runCopy, runKeep, runPreview, runReport, runShow, runStatus, runWatch } from './run/watch';
export type { PreviewOptions, ShowOptions, WatchRunOptions } from './run/watch';
export {
  runAbort,
  runAttach,
  runCanWrite,
  runContinue,
  runFinish,
  runRelease,
  runResolve,
  runRestore,
  runResume,
  runStop
} from './run/lifecycle';
export type { FinishOptions } from './run/lifecycle';
export { taskNext, taskTake } from './task/next';
export { claimCommand, taskDiscard, taskProposeShared } from './task/files';
export type { ClaimOptions } from './task/files';
export { taskCheck, taskComplete, taskFound, taskProgress, taskUnblock } from './task/work';
export { taskProve } from './review/prove';
export { taskRun } from './task/taskRun';
export type { ProveOptions } from './review/prove';
export { taskLeave } from './review/leave';
export { taskReassign, taskRevert } from './review/reassign';
export { taskEscalate } from './review/escalate';
export { taskReview } from './review/review';
export { taskLook } from './look/taskLook';
export { taskShow } from './task/show';
export type { LookOptions } from './look/lookOptions';
export type { ReviewOptions } from './review/review';
export { taskContextCommand } from './task/brief';
export {
  runBacklog,
  runFeedback,
  runNotice,
  taskAnswer,
  taskInbox,
  taskMessage,
  taskProposals,
  taskPropose,
  taskTell
} from './task/talk';
export type { AnswerOptions, ProposeOptions } from './task/talk';
export { runReference } from './run/reference';
export type { ReferenceOptions } from './run/reference';
export { runLook } from './look/runLook';
