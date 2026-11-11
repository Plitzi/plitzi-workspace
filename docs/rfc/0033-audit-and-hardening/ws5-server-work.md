# RFC 0033 — WS5 briefs: actions, functions, runtimes, the cluster

> Section numbers here are the full RFC's, `git show c29db583b:docs/rfc/0033-audit-and-hardening.md`: its § 3 holds the
> findings, § 4 the decisions (§ 2 now), § 8 the design notes (§ 4 now). A task named here that is no longer in the RFC
> has shipped: what it made is in the code.

Read [`00-how-to-work.md`](00-how-to-work.md) first. What must not be undone (RFC § 3.6): one isolate per invocation
with its own limits; admission by memory and CPU; a fair share per space; quotas as a paywall, never a silent drop;
light work never waits behind heavy; "Running" means running. The maintainer's rule for this area: **it must not fail
even when it is slow** — judge a change by a load round against its estimate, not by slot counts.

A regression here needs a test that would have caught it, proven on the old code, with real load or injected clocks.

---

## T5.2 — The load round, kept

- **Repo:** `plitzi-sdk-server`. **Finding:** R2. **Size:** M.
- **Read first:** `tmp/load/load2.ts`, `setup3.ts`, `cycle.sh` (git-ignored — the maintainer's; **copy, do not move
  or delete them**), AGENTS.md § "A load probe on the Docker VM" and § "Server work is metered apart".
- **Steps:** bring the probe into the repository as `test/load/` (setup, the round, the estimate), with a `yarn load`
  script and a page in `docs/` saying: what it sends (1,000 actions small to heavy, 1,050 calls, 50 minute-long
  jobs), the estimate and its band (103–150 % is the band, not a regression), how to read `/_stats` refusals (`busy`
  is the queue working), the plan its spaces need so quotas do not read as failures. It refuses any stack but the
  visual one (`settings.mysql.database !== 'project_test_visual'` — keep that check). Fix its limit cases: on
  2026-11-10 they could not run because the set-up no longer makes their actions (40 jobs "the action this job
  belongs to no longer exists", 8 calls 404). Each round writes a result file by date.
- **Do not:** run it against development's stack; run it with less than 16 GB for the Docker VM and read its
  failures as the code's (check `free -m` and `oom_kill` first, as AGENTS.md says).
- **Verify:** one round on the visual stack, its result kept; the limit cases answer with their limits' words.

## T5.3 — A contract for runners

- **Repo:** `plitzi-workspace` (`packages/sdk-actions`, `packages/sdk-runtime`, `packages/sdk-shared` — the functions
  protocol). **Finding:** R3. **Size:** L.
- **Read first:** `packages/sdk-actions/src/engine/jobs/tests/jobQueueContract.ts` (the model to copy);
  `createIsolateRunner` (`sdk-runtime/src/runner/isolate.ts`), `createRemoteRunner`
  (`sdk-actions/src/functions/runner/remote.ts`), the runtime's native runner; the `FunctionRunner` type.
- **Steps:**
  1. `functionRunnerContract`: what any runner does with limits, each stop reason, `ctx` calls, logs, usage, `busy`
     and `too_large`. The three runners pass it.
  2. Put the `ctx` channel behind an interface with two transports: today's socket, and request/response (a signed
     address per run that the code's `ctx` calls post to). Prove the second with a **test** runner that has no socket.
  3. No engine file names the socket after this.
- **Do not:** write a cloud's runner; change the protocol's version without the protocol's own rules
  (`sdk-shared/functions`).
- **Verify:** the contract green for the three runners and the test runner; `yarn turbo run test
  --filter=@plitzi/sdk-actions --filter=@plitzi/sdk-runtime`; the server's e2e in the split topology.

## T5.8 — One trace for a run

- **Repos:** `plitzi-workspace` (kernel, actions, runtime), `plitzi-sdk-server`. **Finding:** R8. **Size:** M.
- **Steps:** take the W3C `traceparent` at the edge (or make one there) and carry it on every hop: the page server's
  call to the worker, the worker's to the runner, the runner's `ctx` calls back, a runtime's. Write the trace id on
  the run's record and on every log line of it; the run's page links its lines by it. No vendor and no exporter by
  default — a deployment may add one.
- **Do not:** add a dependency to the kernel; log a credential in a trace attribute.
- **Verify:** an e2e in the split topology reads one id on the request, the run's record, the runner's log and the
  answer.

## T5.9 — The engine's two closures

- **Repo:** `plitzi-workspace` — `packages/sdk-actions/src/engine/runtime/runAction.ts` (`runAction`, ~450 lines) and
  `engine/jobs/worker.ts` (`createJobWorker`, ~700 lines). **Finding:** R9. **Size:** L. **After T3.2**, the same way.
- **Steps:** extract, with no change of behaviour: admission, the claim loop, slices, endings, the cancel watch —
  each a module with injected clocks and its tests; the two functions compose them.
- **Verify:** their suites unchanged and green (`worker.test.ts`, `worker.capacity.test.ts`, `worker.slices.test.ts`,
  the `runAction.*.test.ts` files); the job-queue contract; a load round within its band (T5.2).

## T5.11 — Backups somewhere else, and a restore with a date

- **Repo:** `plitzi-platform`. **Finding:** PL1. **Size:** M. **Needs the maintainer** (a bucket, a credential — a
  secret; in this repository a push is a deploy).
- **Read first:** `cluster/gitops/databases/mysql/backup-cronjob.yaml`, `…/mongodb/backup-cronjob.yaml`,
  `cluster/docs/04-backup-restore.md` § Offsite, `cluster/docs/10-production-readiness.md` § Open.
- **Steps:** after each dump, copy it off the node to the bucket the maintainer names, encrypted with the cluster's
  age key; retention said in the manifest. A monthly Job that restores the latest dump into a scratch database,
  counts rows of three tables and logs the result in a line the alerts (T5.12) read. Document it in `04-backup-restore.md`.
- **Verify:** `make test` (kustomize + kubeconform); by the maintainer: a dump listed in the bucket, the restore Job
  green once.

## T5.12 — Somebody is told

- **Repos:** `plitzi-platform` (`cluster/gitops/infrastructure/monitoring/`), `plitzi-sdk-server` (the chart, the
  metrics it exports). **Finding:** PL2. **Size:** M. **Needs the maintainer** (where alerts go).
- **Steps:** a receiver for Alertmanager (mail or a chat webhook, its secret in SOPS). Rules: a backup Job failed or
  did not run in 26 h; a volume past 85 %; a certificate 14 days from its end; a pod restarting; and the platform's
  own figures — work waiting past its limit, a pool full for ten minutes, runs failing above a rate — exported from
  what `/_stats` already holds.
- **Verify:** `make test`; by the maintainer: each rule fired once on purpose and received.

## T5.13 — Small drifts

- **Repo:** `plitzi-platform`. **Findings:** PL4, PL5. **Size:** S.
- **Steps:** the cluster's Mongo is 7.0, a laptop's 8.0: move the cluster by the upgrade path the server repository
  has (`yarn services:mongo-upgrade` shows the steps: dump first, the old volume kept) — **with the maintainer, never
  alone**. Third-party images by digest. `terraform/` is the previous AWS stack ("not what runs today — ask before
  touching"): ask whether to archive or delete it, with its two state files.
- **Verify:** `make test`.
