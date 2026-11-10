# RFC 0033 — WS3 briefs: code quality, what is half-moved, nexus

Read [`00-how-to-work.md`](00-how-to-work.md) first. Every task here is a refactor or a test: **behaviour does not
change**. The proof of that is the existing suites, unchanged and green, before and after — say so with their counts.

---

## T3.1 — The sandbox's tests with the sandbox

- **Repo:** `plitzi-workspace`. **Finding:** Q1. **Size:** M.
- **Read first:** `packages/sdk-runtime/src/runner/` (`isolate.ts`, `service.ts`, `driver.ts`, `guest/fetch.ts`,
  `guest/crypto.ts`) and its five small tests; `packages/sdk-actions/src/functions/isolate.test.ts`,
  `isolate.limits.test.ts`, `isolate.cores.test.ts`, `native.test.ts`, `local.test.ts`.
- **Steps:**
  1. Sort each test case in those files: does it test the **runner itself** (limits, the guest's APIs, isolation
     between invocations, the bundle cache, warm-up) or the **engine through a runner** (catalogue, kv, rate limit,
     signing, metering, budgets)? Write the list in the pull request.
  2. Move the runner's cases to `packages/sdk-runtime/src/runner/*.test.ts`, with the helpers they need under a
     `tests/` folder (the workspace's rule: test-only helpers never beside the code). The engine's cases stay.
  3. Add tests beside `guest/fetch.ts`, `guest/crypto.ts`, `service.ts` and `driver.ts` for what each alone decides
     (read each file's comments — every stated rule gets a case).
- **Do not:** create a dependency from `sdk-runtime` on `sdk-actions` (the kernel and runtime import no engine
  value); change any runner code.
- **Verify:** `yarn turbo run test --filter=@plitzi/sdk-runtime --filter=@plitzi/sdk-actions`; break a limit in
  `isolate.ts` on purpose and see `sdk-runtime`'s own suite fail with `sdk-actions` not built; total case count
  before = after + new.

## T3.2 — `session` in parts

- **Repo:** `plitzi-workspace` — `packages/sdk-runtime/src/runner/isolate.ts` (`session`, from ~line 375, ~400 lines,
  some 25 `let`s). **Finding:** Q2. **Size:** M. **After T3.1** (the tests must be in place first).
- **Steps:**
  1. Extract, with no change of behaviour, three parts, each a small module with its own tests:
     **the run's clock** — own time, awaited, late (sleeps woken late), charged CPU, host CPU; pure functions over
     injected `now()`; **the turn holder** — take, give, give-while-waiting; **the stops** — why it stopped and how
     that reads to the platform (`cpu`, `wall`, `memory`, `calls`, `aborted`, `shed` → `busy`).
  2. `session` composes them. Every rule written in the comments (e.g. "a sleep counts what it asked for", "a turn
     waited for is the runner's time") becomes a test of the part that owns it, with clocks injected.
  3. Keep the comments' *why*; delete what the extracted names now say.
- **Do not:** change timings, the watchdog's period, or what is charged to whom; "simplify" a rule you do not
  understand — ask.
- **Verify:** T3.1's suites unchanged and green; the clock's tests run with no isolate; a load round within its band
  (T5.2) — ask the maintainer to run it if T5.2 has not landed.

## T3.3 — Pools: the service and its screen apart

- **Repo:** `plitzi-sdk-server` — `src/services/pools/index.ts` (1,296 lines). **Finding:** Q3. **Size:** M.
- **Steps:** create `src/services/pools/report/` and move there the back-office's view model: the `Screen*` and
  `FigureLevel`/`GaugeLevel` types, the labels and words, `screenInstance`, `totalsOf`, `queueOf`, `overviewOf`,
  `poolsReport`, `instanceLogs` and their helpers. `index.ts` keeps what other services call (`poolScaler`,
  `readHealth`, `poolLoad`, `startPoolHistory`, `startPoolAutoscaling`, `startPoolOverrideExpiry`…). Update importers
  (`src/services/api/admin/pools.ts` and the seeds' pools pages if they import types). Imports name their file
  (`./report/index.ts`).
- **Do not:** change any value the back-office reads; create an import cycle (import the leaf, not a barrel).
- **Verify:** `yarn typecheck`; `yarn vitest run src/services/pools src/services/api/admin`; the back-office's visual
  test; `index.ts` under 400 lines.

## T3.4 — One place for the environment

- **Repo:** `plitzi-sdk-server`. **Finding:** Q4. **Size:** S.
- **Steps:** `grep -rn "process\.env\." src --include='*.ts' | grep -v "src/config/" | grep -vE "\.(test|spec)\."` —
  13 reads today: the email sender and API key (`src/services/api/email/index.ts`), `MAX_TRACKED_PATHS`
  (`api/analytics/meter.ts`), `PASSWORD_HASH_ROUNDS` (`api/auth/password.ts`), `NODE_ENV` in four files, the logger's
  three (which run before settings load — these may stay, with a comment). Move each into `settings`
  (`src/config/settings.ts`) under its domain. Add an ESLint rule (`no-restricted-syntax` or
  `no-restricted-properties`) refusing `process.env` outside `src/config`, `src/entrypoints`, `src/helpers/logger.ts`
  and `scripts/`.
- **Do not:** split `settings.ts` in this task unless it reads better — it is optional and a separate commit.
- **Verify:** `yarn lint` with the rule on; `yarn test`; `yarn test:e2e` (password rounds under `NODE_ENV=test`).

## T3.5 — Lines that reach the log

- **Repo:** `plitzi-sdk-server`. **Finding:** Q5. **Size:** S.
- **Steps:** 90 `console.*` in `src` (most in `ServerHelpers.ts`, `realTimeWS/index.ts`, `api/billing/sync.ts`,
  `bootstrap.ts`, `redis/`, `mongo/`, `gateway/`). Each goes through the logger at its level (a probe answered is
  `debug`; a failure `error`), or is removed. Turn `no-console` on for `src` (scripts and seeds keep it).
- **Why it matters:** every process keeps its last 1,000 logger lines for **Back-office → Pools → Logs**; a
  `console.log` never gets there.
- **Verify:** `yarn lint`; `yarn test`.

## T3.6 — Builder modules with tests

- **Repo:** `plitzi-workspace` — `apps/builder/src/modules/`. **Finding:** Q6. **Size:** L — **one agent per two
  modules**: Connectors + Actions; Fonts + Variables; Visitors + Elements + Transformers.
- **Steps:** for each module: list its pure logic (helpers, reducers, selectors, validators) and test it; then one
  journey in the workspace's e2e (`e2e/`) where a person uses the module end to end. For each new test, **break the
  code once and see the test fail**; list the breaks in the pull request.
- **Do not:** test implementation details of React components; snapshot whole trees.
- **Verify:** `yarn turbo run test --filter=@plitzi/plitzi-builder`; `yarn e2e:ci`.

## T3.7 — Thin packages

- **Repo:** `plitzi-workspace`. **Finding:** Q7. **Size:** M.
- **Steps:** `sdk-variables` (1,375 lines, 1 test) and `sdk-plugins` (no tests) first; then the files of `sdk-style`
  and `sdk-dev-tools` changed most in the last three months and not covered (`git log --since="3 months ago"
  --name-only --format= -- packages/sdk-style | sort | uniq -c | sort -rn | head -20`). Measure line coverage of
  those files before and after (`yarn test:coverage` in the package).
- **Verify:** coverage of the touched files above 70 %, figures in the pull request.

## T3.8 — Exceptions, counted and explained

- **Repo:** `plitzi-workspace` (then the same test in `plitzi-sdk-server`). **Finding:** Q8. **Size:** M.
- **Steps:** 57 `eslint-disable react-refresh/only-export-components` comments: configure the rule per folder in the
  shared config (`packages/sdk-shared/eslint.config.mjs`) and delete the comments. For every remaining
  `eslint-disable`, `any` and `as unknown as` outside tests: remove it, or leave it **with a comment that says why
  there is no alternative** (the repository's rule). Add a test that counts them per package against a table in the
  repository and fails when a count rises.
- **Verify:** `yarn lint`; `yarn typecheck`; the counting test.

## T3.9 — Plans that are not plans any more

- **Repos:** `plitzi-sdk-server` (`docs/agent-workflow-improvements.md`), `plitzi-workspace`
  (`docs/rfc/0032-server-code-split.md`). **Findings:** Q9, Q12. **Decision:** D8. **Size:** M.
- **Steps:**
  1. `agent-workflow-improvements.md` (2026-09-12) lists eight items with check names that exist nowhere
     (`UNKNOWN_TRIGGER_FIELD`…). For each item: find what shipped and under which name (authoring's codes are in
     `packages/sdk-authoring/src/schema/codes/`; triggers as data: `elementTriggers`). What shipped: delete from the
     doc. What did not: one line each in RFC 0033 § 9. **Ask before deleting the file**; if nothing is left, propose
     its deletion.
  2. RFC 0032: phases 0–9 are marked done. Find what is left (phase 11, a lighter `sdk-shared`); either it is done in
     its own task or cut with the reason, then the RFC is deleted by its own rule — what it knew moves to `docs/en`
     and comments. **Ask the maintainer which.**
  3. For D8: measure what the seeds cost — `yarn typecheck` and `yarn lint`, cold and warm, with and without
     `prisma/seeds/spaces/showcase` in scope (use a temporary tsconfig/lint invocation in `tmp/`, never edit the real
     ones for the measurement). Put the figures in RFC § 4, D8's row.
- **Verify:** the docs' link tests (`yarn vitest run prisma/seeds/spaces/platform/docs`); no dangling link to a
  deleted file (`grep -rn "0032-server-code-split\|agent-workflow-improvements"` across the repos).

## T3.10 — The unit run's imports

- **Repo:** `plitzi-sdk-server`. **Finding:** Q10. **Size:** S.
- **Steps:** the unit run spends 65 % of its time importing (2,466 modules evaluated 19,779 times). Try
  `isolate: false` for the tests that share no module state; find the ones that do (`vi.mock`, module-level state)
  and keep them isolated (a second Vitest project). Keep it only where three runs in a row are green and faster.
- **Do not:** hide a test that depends on order.
- **Verify:** `yarn test` three times, times before and after in the pull request.

## T3.11 — The CLI's two halves

- **Repo:** `plitzi-workspace` — `apps/cli`. **Finding:** Q11. **Size:** M.
- **Steps:** a lint rule (`import/no-restricted-paths`) that `src/commands/*` other than `commands/runs`, and
  `src/doctor`, `src/lint`, `src/scaffold`, `src/fix`, do not import `src/runs/*`. Fix what breaks by moving shared
  helpers out of `runs/`. Then the harness as its own chunk in the build (`apps/cli/vite.config.ts`), imported only
  by the commands that use it (`run`, `task`). Measure `plitzi --version`, `plitzi explain navigate` and
  `plitzi page check` (ten runs each, median) before and after.
- **Do not:** change any command's output or flags; make a single-agent command slower.
- **Verify:** `yarn turbo run test lint typecheck --filter=@plitzi/cli`; a test that running `plitzi --version` does
  not load the harness's chunk (check the loaded modules, or the chunk file's access).

---

# nexus — the rule over T3.12–T3.15

**None may cost the store speed** (RFC § 3.4.1). Repository: `nexus`. Read its `AGENTS.md`. The path that runs today
runs the same instructions after your change; new work sits on a miss, on an option that is off by default, or in the
type checker. Run the benchmark (`cd website && npm run bench`) before and after, every case, same machine, and put
both tables in the pull request. A case slower than its own noise means the change is redesigned or dropped — never
merged with a reason. Every change comes with unit tests, the `plitzi-workspace` e2e that exercises it, a
`CHANGELOG.md` entry and the version bump; the maintainer publishes.

## T3.12 — The benchmark holds the line

- **Findings:** N5, N6. **Size:** S. **First of the four.**
- **Steps:** measure each benchmark case's noise (ten runs) and write a tolerance per case. Add a CI job
  (`.github/workflows/ci.yml`) that runs the benchmark on the pull request and on its base **on the same runner in
  the same job**, and fails when a case is slower past its tolerance; print both tables. Add the bundle's size (each
  entry, compressed) with a tolerance. Move the core's tests to a node environment and keep jsdom for `src/react`,
  `src/vue`, `src/next` (Vitest projects in `vite.config.ts`).
- **Verify:** a throw-away branch that adds a `forEach` to a notification loop fails the job; the test run's time.

## T3.13 — A path type with a floor

- **Finding:** N1. **Size:** M. **Types only — no line of what runs changes.**
- **Steps:**
  1. Measure first, in `plitzi-workspace`: `yarn tsc -p apps/builder/tsconfig.app.json --noEmit --extendedDiagnostics`
     (and `apps/sdk`), with `--generateTrace` to see the time under `PathOf` (`src/types/StoreTypes.ts:10`). **If
     `PathOf` is not what costs, the task ends here** with the figures.
  2. Otherwise: a depth the type stops at — past it, `string` — the default chosen from the figures, a type parameter
     for who needs more. Type tests for both sides of the floor.
- **Verify:** time and memory of the two type-checks before and after; `dist` byte-identical except `.d.ts`;
  `yarn typecheck`, `yarn test`.

## T3.14 — Caches that forget the right thing

- **Finding:** N2. **Size:** S.
- **Read first:** `src/helpers/parsePath.ts`, `src/helpers/getByPath.ts` (each keeps its first 4,096 paths and then
  stops caching), `src/createStore/helpers/writeByPath.ts` (256, drops the oldest written).
- **Steps:** a hit must stay **one `Map.get`**. Use two generations: reads hit the young map; a miss looks in the old
  one and promotes the entry; when the young one reaches the limit, the old is dropped and the two swap. Below the
  limit nothing changes. Add a benchmark case: 10,000 distinct paths read in rotation.
- **Do not:** use a classic LRU (it rewrites the map on every hit); add a branch on the hit path.
- **Verify:** every existing case within its tolerance (T3.12); the new case faster. **If a hit cannot be kept at one
  lookup, drop the task and say so.**

## T3.15 — Persistence that waits for the burst, an async that can cancel, a plan retired

- **Findings:** N3, N4, N7. **Size:** M.
- **Steps:**
  1. `src/middleware/persistMiddleware.ts`: an option, **off by default**, that gathers writes into one per tick and
     flushes on `pagehide` and on `destroy`; a storage error (quota) reported through the store's error handlers once.
  2. `src/async/createAsync.ts`: an option by which the fetcher receives an `AbortSignal`, aborted when a newer call
     supersedes it. No `AbortController` is created when the option is off.
  3. `docs/agnostic-core-migration.md` says "Status: Implemented": **ask**, then delete it and keep what it knew in
     the README.
- **Verify:** with the options off, the benchmark and the allocations of `run` unchanged; with them on, 1,000 writes
  in a tick make one `setItem`, hiding the page loses nothing, a superseded call's signal is aborted; README and the
  website's samples updated (`cd website && npm run check:docs`).
