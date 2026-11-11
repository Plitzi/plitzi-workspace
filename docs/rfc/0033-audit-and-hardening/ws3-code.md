# RFC 0033 — WS3 briefs: code quality, what is half-moved, nexus

> Section numbers here are the full RFC's, `git show c29db583b:docs/rfc/0033-audit-and-hardening.md`: its § 3 holds the
> findings, § 4 the decisions (§ 2 now), § 8 the design notes (§ 4 now). A task named here that is no longer in the RFC
> has shipped: what it made is in the code.

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

## T3.8 — Exceptions, counted and explained

- **Repo:** `plitzi-workspace` (then the same test in `plitzi-sdk-server`). **Finding:** Q8. **Size:** M.
- **Steps:** 57 `eslint-disable react-refresh/only-export-components` comments: configure the rule per folder in the
  shared config (`packages/sdk-shared/eslint.config.mjs`) and delete the comments. For every remaining
  `eslint-disable`, `any` and `as unknown as` outside tests: remove it, or leave it **with a comment that says why
  there is no alternative** (the repository's rule). Add a test that counts them per package against a table in the
  repository and fails when a count rises.
- **Verify:** `yarn lint`; `yarn typecheck`; the counting test.
