---
'@plitzi/cli': patch
---

A schedule waits on a run set aside at a limit, instead of firing into it again every minute; an answer too large
for a function's memory stops that function, not the runner.

## Server actions

- **A schedule does not fire into a limit again.** A scheduled run stopped at a limit its plan sets — its memory, its
  CPU, its calls — was set aside at once, and the next fire made another: one job set aside a minute. The schedule now
  waits on that one job (`SweepResult.held`), fires again once it is resumed or cancelled, and tries one by itself a
  day later. An allowance spent (`quota`) does not hold it. A job's attempt says the limit it was stopped at
  (`JobAttempt.limit`).

## Functions

- **An answer a function has no room for stops that function, not the runner.** What the platform answers a call with
  — a value of `ctx.kv`, a `ctx.fetch` body — is copied into the function's isolate, and one larger than the memory it
  had left ended the runner's whole process (`ivm::FatalRuntimeError`, exit 133/134), with every other space's run in
  it: a task reading megabytes into a `small` took a runner down again and again. The answer is now handed over by a
  call into the isolate, which stops at its memory like any of its own code: that run ends saying it went over its
  memory (`Went over its 32 MB of memory…`), and the runs beside it go on.

## To do when you upgrade

- A job store of your own (`JobQueue`): `advanceSchedule` takes `held` — when set, leave `lastFireAt` as it is. The
  stores of `@plitzi/sdk-actions` (memory, file, SQLite, Mongo, MySQL) do.
