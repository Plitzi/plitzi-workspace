# RFC 0033 — WS5 briefs: actions, functions, runtimes, the cluster

Read [`00-how-to-work.md`](00-how-to-work.md) first. What must not be undone (RFC § 3.6): one isolate per invocation
with its own limits; admission by memory and CPU; a fair share per space; quotas as a paywall, never a silent drop;
light work never waits behind heavy; "Running" means running. The maintainer's rule for this area: **it must not fail
even when it is slow** — judge a change by a load round against its estimate, not by slot counts.

A regression here needs a test that would have caught it, proven on the old code, with real load or injected clocks.

---

## T5.1 — The sandbox, attacked

- **Repo:** `plitzi-workspace` — `packages/sdk-runtime`. **Finding:** R1. **Size:** L. **After T3.1.**
- **Steps:** a suite owned by the runner's package, one named case per attempt, each ending in the stop reason or the
  refusal the contract names:
  - reaching the host's globals through prototypes, constructors of host-made values, thrown errors and their stacks;
  - holding or calling the runner's callback references after they were taken off the global;
  - memory: a growing string, an `ArrayBuffer`, an array, a catastrophic regular expression;
  - time: a tight loop, a flood of timers, a flood of microtasks, a sleep past the wall limit;
  - calls past the plan's count;
  - `fetch` to a host not declared; through a redirect to one; to an address written in decimal, hex, octal, mapped
    IPv6, with userinfo, in full-width digits; to a name that resolves inside (the kernel's `outboundGuard` already
    refuses these — the test pins it from the guest's side);
  - a second invocation reading anything the first left;
  - the bundle's top level doing any of the above while it is read.
- **Do not:** weaken a limit to make a case pass; publish what you find.
- **If a case gets through:** stop. Tell the maintainer privately, with the case. Fix first, describe after.
- **Verify:** the suite runs with `sdk-runtime` alone (`yarn turbo run test --filter=@plitzi/sdk-runtime`).

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

## T5.4 — Run records that are not lost quietly

- **Repo:** `plitzi-sdk-server` — `src/services/actionRuns/batch.ts`. **Finding:** R4. **Size:** M.
- **Steps:** records are written in bursts every 100 ms; a failed burst logs how many it lost. Keep a failed burst
  and retry it with back-off, up to a bound of records and of minutes (both settings); past the bound, count the loss
  in the process's stats and show it in **Back-office → Health**. Clocks injected.
- **Do not:** make a run wait for its own record; grow memory without a bound.
- **Verify:** `yarn vitest run src/services/actionRuns` — a store that fails three times loses nothing; one that
  fails for ever reports the number; the bound holds.

## T5.5 — Realtime across replicas

- **Repo:** `plitzi-sdk-server` (and `plitzi-workspace` if the cause is the mechanism's). **Finding:** R5. **Size:** M.
- **Steps:** open since September: with two page-server replicas and no affinity, realtime over SSE answered 401 on
  the other replica. Reproduce in the split-topology e2e with two page servers, over SSE and over WebSocket. If it
  still fails: the channel's grant is checked against the shared store, not the replica's memory.
- **Verify:** the e2e, green on both transports; `visual/pizarra.spec.ts`.
- **If it no longer reproduces:** keep the e2e and close the finding.

## T5.6 — Work set aside is said

- **Repo:** `plitzi-sdk-server`. **Finding:** R6. **Size:** M.
- **Steps:** Step 0: what the owner of a space is shown and sent when runs are refused for quota (402) or jobs are
  set aside. If nothing reaches them unasked: one calm notice on the console's home ("Needs attention" already
  exists) and one email per period — amber, not red; titles not ids; and **say what is not affected** (pages keep
  being served).
- **Verify:** a visual step for the notice; an e2e that the email is sent once per period, not per run.

## T5.7 — Pools: mechanism or data

- **Repo:** `plitzi-sdk-server` — `src/services/pools/` (8,004 lines). **Finding:** R7. **Size:** S. **No code.**
- **Deliver:** in RFC § 8, a table of each file of `services/pools` by who needs it — any deployment (mechanism:
  belongs in the packages) or Plitzi's own (data and policy: stays) — against what RFC 0032 § 7 already moved, with a
  recommendation. The maintainer decides; nothing moves in this task.

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

## T5.10 — One resolution, one connection

- **Repo:** `plitzi-workspace` — `packages/sdk-kernel/src/outbound/outboundGuard.ts`. **Finding:** R10. **Size:** M.
- **Why:** the guard judges the addresses a name resolves to, then the transport resolves the name again — DNS
  rebinding is open, and the file says so. It matters most at the worker, which makes the requests a space's steps
  author and shares a namespace with the databases (PL3).
- **Steps:** the guarded request connects to the address it judged: a dispatcher whose `connect.lookup` answers only
  the vetted addresses, for the first request and for every redirect (each redirect is judged again — keep that).
  Every authored request goes through it: functions' `fetch`, connectors, the `http.request` step
  (`grep -rn "assertOutboundAllowed" packages apps`). A lint rule refuses a bare `fetch` to an authored host in those
  modules.
- **Do not:** set a global dispatcher that changes other requests (read AGENTS.md § undici import side effect in the
  maintainer's notes if you touch `undici`); break `privateOrigins`.
- **Verify:** a test with a resolver that answers a public address at the check and a private one at the connection:
  refused. The kernel's outbound tests; the engine's `http` task tests.

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
