# RFC 0027 — Long jobs: work that outlives a request

- **Status:** Accepted — design settled with Carlos (2026-10-11, 2026-10-18), not built
- **Author:** Carlos Rodriguez
- **Date:** 2026-10-18
- **Scope:** `@plitzi/sdk-server` (the job queue, its worker, the functions protocol, `ctx.jobs`), `@plitzi/sdk-shared`
  (the types), `@plitzi/plitzi-sdk` (`useJob`), plitzi-sdk-server (the Mongo queue, the plans, the Queue panel), the
  docs and the skills
- **Origin:** PZ-136 (aiko, iteration 12)

---

## 1. Summary

A space's code lives as long as one invocation: a task step or a route request, cut at 10 s (120 s when it streams).
The runtime, its own process, has no channel to the platform outside an invocation either. So work that takes minutes —
training a model, importing a catalogue, transcoding, a crawl — has nowhere to live: the agent building aiko kept a
process of its own and its own progress table.

A **job** is that work, declared beside the tasks and routes:

```ts
export default defineFunctions({
  jobs: {
    train: {
      watch: { mode: 'role', permissions: ['models.read'] },
      run: async (input, job, ctx) => {
        let state = job.state ?? { epoch: 0 };
        for (; state.epoch < input.epochs; state.epoch++) {
          await trainEpoch(state, ctx);
          await job.save(state);
          job.report((state.epoch + 1) / input.epochs, `epoch ${state.epoch + 1}`);
          if (job.signal.aborted) return; // paused or cancelled: what was saved is where it resumes
        }

        return { accuracy: state.accuracy };
      }
    }
  },
  routes: {
    'POST /train': async (request, ctx) => Response.json(await ctx.jobs.start('train', await request.json()))
  }
});
```

```tsx
const train = useJob(jobId); // { status, progress, step, result, error } — live, for whoever `watch` lets in
```

It runs in the queue the schedules already use: durable, exactly-once by id, leased with a heartbeat, taken over when a
replica dies, retried with backoff, shown in the Queue panel. It runs wherever the space's code runs: the sandbox
**and** a runtime.

## 2. Decisions

| Question | Decision |
|---|---|
| Where a job runs | Both: the sandbox and a runtime, through the functions protocol both already speak |
| Pause | A real pause: the job stops, keeps what it saved, and resumes from there |
| Quotas | By plan, sized against the competition (§6) |
| Who sees the progress | The space's RBAC: a job declares who may watch it, as a channel does |

## 3. The model: a job runs in slices

A job is one `run(input, job, ctx)` that may be invoked more than once. Each invocation is a **slice**; a slice ends when
`run` returns (done), throws (failed), or is stopped: a pause, a cancel, the slice's time limit, a replica going away.

- **`job.save(state)`** writes the job's state durably (JSON, size by plan). The next slice starts with `job.state` set
  to the last state saved. Nothing else survives a slice: the code saves at its checkpoints.
- **`job.report(fraction, step?)`** says how far it is (`0..1`) and what it is doing. Kept on the job, published to
  whoever watches; throttled to a few a second, the last one always kept.
- **`job.signal`** aborts when the slice is asked to end — `job.stopping` says why: `'pause'`, `'cancel'`, `'limit'`
  (the slice's time is up) or `'shutdown'`. The code gets a grace (5 s) to save and return before the slice is cut.
- **A slice that ends by its limit continues** — a new slice, at once, not an attempt — **if it saved since it began**.
  One that saved nothing counts as a failed attempt ("ran out of time without saving progress"): otherwise a job that
  never checkpoints would loop forever.
- **A throw** retries from the last save, with the queue's backoff, up to `maxAttempts` (3). `ActionRefusal` does not
  retry. **A lost slice** (the replica died) is taken over when its lease lapses, from the last save, as the queue does
  today.

In the sandbox a slice is bounded by the plan's slice time and CPU (§6). In a runtime a slice is bounded only by the
job's total duration: the code is its own process, held by the lease and its heartbeat.

## 4. The surface

- **Declared** in `defineFunctions({ jobs: { <name>: { run, watch?, limits?: { maxSeconds? } } } })`. A name is a letter,
  then letters, digits and `-`. Validated with the manifest; `/fn/jobs/*` reserved.
- **`ctx.jobs.start(name, input, { key? })`** → `{ id }`. `key` makes it idempotent: starting the same key while one
  runs answers that one (a "train this model" button pressed twice). Refused, with the reason, over the plan's limits.
- **`ctx.jobs.get(id)`** → `{ id, name, status, progress, step, result, error, startedAt, endedAt }`.
- **`ctx.jobs.pause(id)`, `resume(id)`, `cancel(id)`** → whether it changed. The code decides who may: they are called
  from its routes and tasks, behind its own checks. An operator does the same from the Queue panel.
- **`useJob(id)`** in a page (`@plitzi/plitzi-sdk`): the job as state, live — the retained channel `$job:<id>`, which
  hands the latest to a page that joins late. A `job` source for the schema, the same fields.
- **Status:** `pending` → `running` ⇄ `paused` → `succeeded` | `failed` | `cancelled` (and the queue's `dead`).

## 5. Who sees a job

`watch` is a channel's `access`: `{ mode: 'public' }`, `{ mode: 'session' }` or `{ mode: 'role', permissions: [...] }`,
read against the visitor's roles in the space (the same RBAC the channels and visitor roles use). **Default: whoever
started it** — the job carries its starter's user id, and a page of that user sees it; nobody else does until `watch`
says so. The id alone opens nothing: the door is the realtime's, as for any channel.

## 6. Quotas

Functions already run only on the paid plans (Pro, Max, Lifetime as Pro). What others give, as of 2026-10:

| | Running at once | One run | Per step / slice |
|---|---|---|---|
| Trigger.dev | 10 free, 25 Hobby, 100–200 Pro | hours, no fixed cap | — |
| Inngest | ~5 free | — | 1,000 steps a function, 4 MB a step |
| Cloudflare Workflows | 100 free, 10,000 paid | unlimited wall | CPU 10 ms free, 30 s–5 min paid; state 100 MB / 1 GB |
| Vercel | — | 300 s Hobby, 800 s Pro (Workflows: unlimited) | — |
| Netlify background | — | 15 min | — |

Plitzi's, per **workspace** (the plan is the workspace's), enforced when a job is started and when it is claimed:

| | Pro / Lifetime | Max |
|---|---|---|
| Running at once | 10 | 50 |
| Waiting (per space) | 1,000 | 10,000 |
| Total duration of a job | 6 h | 24 h |
| Slice in the sandbox | 5 min wall, 30 s CPU | 15 min wall, 2 min CPU |
| Saved state | 1 MB | 8 MB |
| Kept after it ends | 30 days | 90 days |

Above Trigger.dev's Pro in duration and below Cloudflare's paid in concurrency: a platform that hosts sites, where a job
is a feature of a site, not a product's whole backend. A self-hosted server sets its own (`functions.jobs` limits, no
plan); the defaults there are Pro's.

## 7. Where each part lives

- **sdk-server:** the job kind in the queue (`ActionJobInput.kind: 'action' | 'function'`, `name`, `state`, `progress`,
  `paused`), the worker's slice loop, `FunctionInvocation { kind: 'job' }` and the calls `job.save` / `job.report`, the
  `ctx.jobs` capability, the `$job:<id>` channel and its `watch` door, the limits seam (`functions.jobs.limitsFor`).
- **sdk-shared:** the types (`FunctionJob`, `FunctionJobStatus`, the manifest's `jobs`).
- **plitzi-sdk:** `useJob`, and the `job` source.
- **plitzi-sdk-server:** the Mongo queue's new fields and `pause`/`resume`, the plans' numbers (two columns, an additive
  migration), the Queue panel showing progress with pause/resume.
- **Docs:** `docs/en/functions.md` (jobs), the website's functions page, the CLI skill.

## 8. Phases

1. The queue: the job kind, `state`/`progress`, `pause`/`resume`, in the memory queue and the Mongo one, with the
   contract tests both run.
2. The worker's slice loop and the functions protocol (`kind: 'job'`, `save`, `report`), native first, then the sandbox,
   then a runtime.
3. `ctx.jobs`, the limits seam and the plans.
4. The channel, `watch`, `useJob` and the `job` source.
5. The Queue panel, the docs, the skills; aiko's training moved onto it as the proof.

## 9. Left out on purpose

- **Steps memoized by name** (Inngest's `step.run`): `job.save` is the one checkpoint, explicit, and enough for a loop.
  A job that wants steps keeps their results in its state.
- **Waiting for an event inside a job** (`waitForEvent`): a job that waits is a job that should end and be started again
  by what it waited for.
- **Jobs of a plugin's functions**: a plugin declares none, as it declares no OAuth connection — the space's are the
  space's.
