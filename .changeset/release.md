---
'@plitzi/cli': patch
---

A/B tests: an element that shows each visitor one of two variants, and keeps it; a run's single-flight key never
outlives its lifetime; a queue's jobs set aside are resumed at once.

## Elements

- **A/B tests.** `abTest` — in the builder's new **Testing** category — holds two to five `abTestVariant`s, A first,
  and draws the one a visitor is shown, drawn by the variants' `weight`s (0–100 each, against the others'). Its
  `experiment` names it: the visitor's variant is kept under it in a cookie (`plitzi_ab`), so a reload or a later visit
  shows the same, and a visitor keeps theirs when the weights change. A variant at 0 is shown to nobody (its visitors
  are drawn again); one left with a weight ends the experiment for everybody. Two tests with one name share it.
  The page server draws the side and sends the cookie with the page; the browser hydrates with what it drew and draws
  only what no server did (a space with no server, a static copy). The builder's canvas shows the side the test's
  settings name (`builderVariant`). `{{ experiments.<name> }}` — a new global source — reads `'a'`, `'b'`…, for a
  flow to report with what it measures. Authoring writes `abTest()` / `abTestVariant()`, and the linter says
  `experiment-unnamed`, `experiment-name`, `experiment-weight`, `experiment-weights-differ`,
  `experiment-builder-variant`, `experiment-variants` and `experiment-unknown`.
- **A tester forces a variant** where debugging is authorized: the dev tools' new **Experiments** tab, or
  `?ab=heroTest:b` in the address, kept for the visit in a session cookie of its own (`plitzi_ab_qa`) — shown over the
  visitor's variant, never kept as theirs. The server draws it (`forcedExperiments`), never keeps that page, and a
  forced experiment the space does not run is ignored and said in the console.
- **A page server's HTML cache is keyed by the visitor's variants**, and a page that drew a visitor theirs is never
  kept: the next visitor with none is drawn their own.

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

- A server or a proxy that caches pages of its own in front of `@plitzi/sdk-server` keys them by the `plitzi_ab`
  cookie as well (`plitzi_ab_<port>` on a port), and never keeps a response that sets it — or every visitor behind the
  first is shown the first one's side of an A/B test.

- A key left without a lifetime by a version before this one is not freed by it: find the deployment's single-flight
  keys with no lifetime (`action:run:<space>:<action>:…`, in Redis `TTL` answers `-1`) and delete them.
- A job store of your own (`JobQueue`) needs `resumeWaiting`: one statement that sets the matching `paused` jobs
  `pending`, as `resume` does one. The stores of `@plitzi/sdk-actions` (memory, file, SQLite, Mongo, MySQL) have it.
