---
'@plitzi/cli': patch
---

A queue's jobs that have not started are dropped at once, rather than a job at a time; a schedule never stacks jobs
set aside.

## Server actions

- **A queue is emptied in one go.** `JobQueue.cancelWaiting({ spaceIds, status?, kind?, name? })` drops every job of
  those spaces that has not started — waiting to run (`pending`) or set aside (`paused`), narrowed to one of the two, to
  actions or the functions' jobs, to one action or job — and answers how many, with the functions' jobs among them. A
  schedule whose every run was set aside left a job a minute, and the only way out was `cancel`, a job at a time. A
  running job is left: only the worker holding it can stop it, so it is still cancelled by itself. `createJobControl`
  offers it too, and tells whoever watches a job of the functions that it was cancelled.

- **A schedule never stacks jobs set aside.** A schedule already waited on a run stopped at a limit of its code's
  (memory, CPU, calls…); it now waits too on one refused because its plan's allowance for the period is spent (`quota`)
  — asking again by itself an hour apart, where it was a job set aside a fire for the rest of the period — and on one
  no worker of the deployment may hold. And when it does fire while the job of its fire before is still set aside (the
  wait is up, or that job failed every attempt), the new fire takes its place: the one before is cancelled
  (`SweepResult.superseded`). A schedule has one job set aside at most, where each used to stay for ever.
  `heldAtLimit` and `HOLDS_SCHEDULE` are `scheduleHold`.

## To do when you upgrade

- A job store of your own (`JobQueue`) needs `cancelWaiting`: one statement that sets the matching `pending` and
  `paused` jobs `cancelled`, as `cancel` does one. The stores of `@plitzi/sdk-actions` (memory, file, SQLite, Mongo,
  MySQL) have it.
