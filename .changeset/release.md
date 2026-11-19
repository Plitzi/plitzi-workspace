---
'@plitzi/cli': patch
---

A run's single-flight key never outlives its lifetime; a queue's jobs set aside are resumed at once.

## Server actions

- **A single-flight key is taken with its lifetime in one write.** The run guards took it with `increment` and gave it
  its lifetime with an `expire` after: a store that failed the second — a Redis timing out through a rollout — kept the
  key for good, and every later run of that action with that input was refused as "already running" while nothing ran.
  A scheduled job came back to the queue every second or two for as long ("Waiting for the same run to finish"), with
  no run anywhere to wait for. The key is now written with `swap` — only where nothing holds it, with the run's lifetime,
  at once — and holds the run's id. `RunKeyStore` is `get`, `set`, `swap` and `delete` of `ActionKvAdapter`.

- **A queue's jobs set aside are resumed at once.** `JobQueue.resumeWaiting({ spaceIds, kind?, name? })` puts every
  `paused` job of those spaces back in the queue — narrowed to actions or the functions' jobs, to one action or job — as
  `resume` puts one, each set aside after failing every attempt with every attempt again, and answers how many, with
  the functions' jobs among them. A group of a schedule's runs set aside (`listJobGroups`) was resumed a job at a time:
  the latest alone, while the row went on saying the rest. `createJobControl` offers it too, and tells whoever watches
  a job of the functions that it is back.

## To do when you upgrade

- A key left without a lifetime by a version before this one is not freed by it: find the deployment's single-flight
  keys with no lifetime (`action:run:<space>:<action>:…`, in Redis `TTL` answers `-1`) and delete them.
- A job store of your own (`JobQueue`) needs `resumeWaiting`: one statement that sets the matching `paused` jobs
  `pending`, as `resume` does one. The stores of `@plitzi/sdk-actions` (memory, file, SQLite, Mongo, MySQL) have it.
