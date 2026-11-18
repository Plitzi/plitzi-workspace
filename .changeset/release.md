---
'@plitzi/cli': patch
---

A schedule waits on a run set aside at a limit, instead of firing into it again every minute.

## Server actions

- **A schedule does not fire into a limit again.** A scheduled run stopped at a limit its plan sets — its memory, its
  CPU, its calls — was set aside at once, and the next fire made another: one job set aside a minute. The schedule now
  waits on that one job (`SweepResult.held`), fires again once it is resumed or cancelled, and tries one by itself a
  day later. An allowance spent (`quota`) does not hold it. A job's attempt says the limit it was stopped at
  (`JobAttempt.limit`).

## To do when you upgrade

- A job store of your own (`JobQueue`): `advanceSchedule` takes `held` — when set, leave `lastFireAt` as it is. The
  stores of `@plitzi/sdk-actions` (memory, file, SQLite, Mongo, MySQL) do.
