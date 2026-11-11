# RFC 0033 — WS3 briefs: code quality, what is half-moved, nexus

Read [`00-how-to-work.md`](00-how-to-work.md) first. Every task here is a refactor or a test: **behaviour does not
change**. The proof of that is the existing suites, unchanged and green, before and after — say so with their counts.

---

## T3.2 — `session` in parts

- **Done** 2026-11-10: `runClock.ts`, `turnHolder.ts`, `stops.ts`, each with its tests; `session` composes them.
- **Left:** a load round within its band (T5.2). Ask the maintainer to run it while T5.2 has not landed; a result
  outside the band is a regression of this split until shown otherwise.

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
  (`docs/en/server-packages.md`, where RFC 0032's decisions went). **Findings:** Q9, Q12. **Decision:** D8. **Size:** M.
- **Steps:**
  1. `agent-workflow-improvements.md` (2026-09-12) lists eight items with check names that exist nowhere
     (`UNKNOWN_TRIGGER_FIELD`…). For each item: find what shipped and under which name (authoring's codes are in
     `packages/sdk-authoring/src/schema/codes/`; triggers as data: `elementTriggers`). What shipped: delete from the
     doc. What did not: one line each in RFC 0033 § 9. **Ask before deleting the file**; if nothing is left, propose
     its deletion.
  2. docs/en/server-packages.md: phases 0–9 are marked done. Find what is left (phase 11, a lighter `sdk-shared`); either it is done in
     its own task or cut with the reason, then the RFC is deleted by its own rule — what it knew moves to `docs/en`
     and comments. **Ask the maintainer which.**
  3. For D8: measure what the seeds cost — `yarn typecheck` and `yarn lint`, cold and warm, with and without
     `prisma/seeds/spaces/showcase` in scope (use a temporary tsconfig/lint invocation in `tmp/`, never edit the real
     ones for the measurement). Put the figures in RFC § 4, D8's row.
- **Verify:** the docs' link tests (`yarn vitest run prisma/seeds/spaces/platform/docs`); no dangling link to a
  deleted file (`grep -rn "0032-server-code-split\|agent-workflow-improvements"` across the repos).

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
