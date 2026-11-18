---
'@plitzi/cli': patch
---

A process's stats and the queue's summary count by the environment of the spaces too, for a view narrowed to one.

## Server

- **Work is counted by environment.** A process's `/_stats` says, beside each minute's own figures, what of them was
  for each environment of the spaces (`series[].environments`: runs, failed, limited, refused) and how much of what it
  holds in flight each environment's is (`load.slots[…].environments`) — a worker's calls, renders and jobs, a
  runner's invocations. `JobQueue.summarize` answers the jobs by status for each environment
  (`environments`), the one with the most first, and `listAcross` lists one environment's jobs alone when asked
  (`environment`). Production's work reads apart from a builder's rehearsals in `main`.
  What nobody named an environment for is in the totals alone: the parts never add up to more than them.

## To do when you upgrade

- A job store of your own (`JobQueue`): `summarize` answers `environments` — the count by status for each environment
  — beside `byStatus`. `statusCounts` (`@plitzi/sdk-actions`) folds a store's own grouping by status and environment
  into both — and `listAcross` takes an `environment` to list one's jobs alone. The stores of `@plitzi/sdk-actions`
  do both.
- A recorder of your own, or code that calls one: `run`'s label takes `environment`, `refuse` a second argument, and
  `slot` an `environments` reader. All optional: what says none is counted as before.
