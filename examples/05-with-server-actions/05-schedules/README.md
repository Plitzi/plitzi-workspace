# Schedules and delayed jobs, self-hosted

Work that runs on a clock — every minute, at nine on weekdays in Madrid — and work that runs **later**: in five
seconds, after a backoff, on whichever replica is free. All of it over a durable queue this server keeps itself, in
one SQLite file, with nothing to install.

```bash
yarn start
yarn start:dev   # the same, reloading on save, while you edit it
# http://127.0.0.1:4016/
```

The page is the whole demo. **Queue the reminder** and it appears on the board as *Waiting*, turns *Done* five
seconds later and writes to the activity feed. The three buttons under it are the failures a queue exists for:

| Button | What you see |
|---|---|
| Flaky sync — refused twice, then works | Two failed attempts, each retried after a backoff; the third goes through |
| Doomed sync — refused every time | Three failed attempts, then *Gave up* — press **Run again** and it is back in the queue with its history kept |
| Slow export — 20 seconds of work | *Running* for twenty seconds. Press **Cancel** and it stops within a heartbeat |

Above them, the **Minute heartbeat** fires on every minute boundary, on its own.

## Two replicas

```bash
PORT=4017 yarn start   # in a second terminal
```

Same file, so it is a second replica rather than a second copy: the two share the jobs, the schedules and the run
guards' keys. The heartbeat still fires **once** a minute — whichever replica sweeps first writes the job, and the
other one's identical write is a no-op. The activity feed names the replica that did each thing.

Now start a slow export and `kill -9` the replica running it (the board says which one). Its lease lapses after ten
seconds and the other replica takes the job over — the history reads `#1 lost on replica-4016 · #2 succeeded on
replica-4017`. The takeover waits for the dead replica's single-flight key to expire too (the run timeout, thirty
seconds here), which is what stops a replica that merely *stalled* from running the export alongside its
replacement.

Stop both for three minutes and start one again: the heartbeat runs **once**, and its schedule row says it missed
two. An outage is not replayed as a burst.

## What matters

**The queue is a seam, and this example fills it.** [`src/store/queue.ts`](./src/store/queue.ts) is the
`ActionJobQueue` contract written out in full over SQLite — the same one `sdk-server` keeps in memory by default,
which is right for one process and silently wrong for two. Four rules make it safe to run anywhere, and each one is a
single place in that file:

| Rule | Where |
|---|---|
| Every instant comes from the store | `storeNow` — never `Date.now()`; `settle` and `claim` take durations |
| `enqueue` is idempotent by id | `ON CONFLICT (id) DO NOTHING`, answering whether it inserted |
| `claim` is atomic, and it reaps | one `BEGIN IMMEDIATE` that takes due jobs AND jobs whose lease lapsed |
| `advanceSchedule` is compare-and-set | `WHERE next_run_at = from` |

Against Postgres the same shape is `SELECT … FOR UPDATE SKIP LOCKED`; against Mongo, `findOneAndUpdate`.

**So is `kv`, and it is not optional past one replica.** A worker takes a job's single-flight key before running
it, and with the default in-process Map each replica holds its own keys — so a stalled replica waking up would run
the job a second time. [`src/store/kv.ts`](./src/store/kv.ts) keeps them in the same file.

**Three keys wire it**, in [`src/main.ts`](./src/main.ts):

```ts
action: { lookups, kv, jobs: { queue, spaces: [SPACE_ID], workers: 2 } }
```

`lookups.listActions` is what turns scheduling on at all — without it there is no way to know what a space has
scheduled. `spaces` is the self-hosted shape: one space, named once. The rest of `jobs` is tuned so the demo moves
at the speed of somebody watching it; the defaults are the right ones in production.

**A schedule is a row, not a timer.** [`src/actions.ts`](./src/actions.ts) declares three `schedule` triggers — one
of them switched off, which keeps its row so the board can say so. At boot the server derives each one's next fire
and writes it down; from then on every replica reads that instant instead of asking its own clock. A cron with no
zone is evaluated in UTC, and everything the board prints is UTC too: replicas in different countries agree about
it and about nothing else.

**"In five seconds" is a job with a due time.** The page calls `remind-me`, whose one step, `example.enqueue`,
puts a job on the queue for the `reminder` action and answers at once. `reminder` has no `call` trigger — only a
`custom` one named `queue` — so a page cannot run it directly, and the enqueue step refuses any action that does
not declare that trigger. When the job comes due, a worker runs it through the same runner a page call goes
through, with every check that implies.

**A retry is not a new job.** The flaky sync counts its attempts in `kv`, keyed by its own job id, because the run
id changes with every attempt and the next attempt may run on the other replica. When a job gives up, its error
names the step that failed and what it said.

**The board is one server provider that refreshes itself.** `refreshSeconds: 2` on the `apiContainer` asks the
server for its slice again every two seconds — the same `queue-board` render action, run again. It pauses while the
tab is hidden and never stacks a refresh on one still in flight. The page has no endpoint of its own and no client
code; the operator's **Run again** and **Cancel** are two more actions.

> The operator actions are `access: 'public'` because this example has no sign-in. On a real site they are behind
> `{ mode: 'role', permissions: [...] }` — running a job again sends the email again.

## The file

The queue lives in `.data/queue.db` (ignored by git). Delete it to start from nothing, or point `QUEUE_DB` somewhere
else. `REPLICA` overrides the name a process goes by; it defaults to `replica-<port>`.

## Next

The mechanism is documented in [`server-actions.md`](../../../docs/en/server-actions.md) — §6 for schedules, §13 for
the seams a self-hosted deployment owns.
