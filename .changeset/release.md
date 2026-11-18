---
'@plitzi/cli': patch
---

A queue's jobs that have not started are dropped at once, rather than a job at a time.

## Server actions

- **A queue is emptied in one go.** `JobQueue.cancelWaiting({ spaceIds, status?, kind?, name? })` drops every job of
  those spaces that has not started — waiting to run (`pending`) or set aside (`paused`), narrowed to one of the two, to
  actions or the functions' jobs, to one action or job — and answers how many, with the functions' jobs among them. A
  schedule whose every run was set aside left a job a minute, and the only way out was `cancel`, a job at a time. A
  running job is left: only the worker holding it can stop it, so it is still cancelled by itself. `createJobControl`
  offers it too, and tells whoever watches a job of the functions that it was cancelled.

## To do when you upgrade

- A job store of your own (`JobQueue`) needs `cancelWaiting`: one statement that sets the matching `pending` and
  `paused` jobs `cancelled`, as `cancel` does one. The stores of `@plitzi/sdk-actions` (memory, file, SQLite, Mongo,
  MySQL) have it.
