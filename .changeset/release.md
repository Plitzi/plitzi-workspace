---
'@plitzi/cli': patch
---

A run's single-flight key never outlives its lifetime.

## Server actions

- **A single-flight key is taken with its lifetime in one write.** The run guards took it with `increment` and gave it
  its lifetime with an `expire` after: a store that failed the second — a Redis timing out through a rollout — kept the
  key for good, and every later run of that action with that input was refused as "already running" while nothing ran.
  A scheduled job came back to the queue every second or two for as long ("Waiting for the same run to finish"), with
  no run anywhere to wait for. The key is now written with `swap` — only where nothing holds it, with the run's lifetime,
  at once — and holds the run's id. `RunKeyStore` is `get`, `set`, `swap` and `delete` of `ActionKvAdapter`.

## To do when you upgrade

- A key left without a lifetime by a version before this one is not freed by it: find the deployment's single-flight
  keys with no lifetime (`action:run:<space>:<action>:…`, in Redis `TTL` answers `-1`) and delete them.
