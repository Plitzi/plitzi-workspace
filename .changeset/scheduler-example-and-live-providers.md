---
'@plitzi/sdk-server': patch
'@plitzi/sdk-elements': patch
'@plitzi/sdk-authoring': patch
'@plitzi/plitzi-sdk': patch
---

- **An every-minute schedule fired every other minute.** After producing a fire, the scheduler asked for the next
  one from `lateness + 1 minute`, and `cronNextFire` rounds up to a whole minute — so a sweep that ran even a second
  late (with the default 15-second sweep, nearly all of them) skipped the minute it should have produced. It now asks
  from the minute after the one the sweep ran in. Only expressions with consecutive-minute fires were affected;
  hourly and daily schedules were not.
- **A job that gives up says which step failed and why.** Its `error` and the failed attempt in its history used to
  read "the flow ended failed" for every failure there is; they now read `step "<id>" failed: <message>`, taken from
  the run's outline — already redacted of every credential the run resolved, so nothing reaches the job that the
  run history would not show.
- **`apiContainer` takes `refreshSeconds`**: it asks again on its own every N seconds, for a page showing something
  still moving — a queue, a feed, a status board. It is the same refresh `performQuery` runs, so it works for both
  runtimes (a browser request is sent again; a server provider asks for its own RSC slice again). It pauses while
  the tab is hidden and never starts a refresh while the last one is in flight. `0`, the default, never does. Before
  this a live server provider needed a plugin element of its own to call `useRscRefresh` on a timer: `onApiSuccess`
  never fires for a server provider, so there was no way to author the loop. The builder shows it as "Refresh every
  (s)" for either runtime.
- **`variantFrom(cls, source)`** in `@plitzi/sdk-authoring` binds which of a CLASS's variants an element wears to a
  value in the data — a status pill that is amber while a job waits and green once it is done. Written by hand the
  variant key is the trap: it names the selector the variants belong to, and the element's type (`text.base`) is a
  different selector from its class (`statusPill.base`), so the element rendered with no variant and nothing
  reported it. The helper takes the key from the class declaration.
- **`authorSpace` refuses a flow template that reads a source by its short name.** A binding completes the prefix
  (`jobRows.item.id` → `list_jobRows.item.id`), so the short form is the one an author learns first; a step's params
  are read as written, and there it resolved to nothing — a row's button posted an empty id and every layer below
  reported success. The error names the full source. A root that is a step of the same flow is left alone.
- New example, [`05-with-server-actions/05-schedules`](../examples/05-with-server-actions/05-schedules): scheduled and
  delayed jobs on a self-hosted server, with the `ActionJobQueue` and `kv` seams written out in full over one SQLite
  file, two replicas sharing it, failover when one is killed, and a board that watches it happen.
