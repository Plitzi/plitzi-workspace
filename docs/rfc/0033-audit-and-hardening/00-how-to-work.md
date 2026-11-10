# RFC 0033 — how an agent works a task

Read this whole page before any task of RFC 0033. The RFC ([`../0033-audit-and-hardening.md`](../0033-audit-and-hardening.md))
holds the findings and one row per task; **the row is a summary, the brief is the instruction**. Briefs are in this
folder, one file per workstream:

| File | Tasks |
|---|---|
| [`ws0-gates.md`](ws0-gates.md) | T0.1–T0.15 — advisories, CI, budgets, flaky tests, security doors |
| [`ws1-page-weight.md`](ws1-page-weight.md) | T1.1–T1.7 — the space document, the SDK bundle, icons, styles, shift |
| [`ws2-website-and-sign-in.md`](ws2-website-and-sign-in.md) | T2.1–T2.28 — the `website`, `auth` and `docs` seeds, the builder's bar |
| [`ws3-code.md`](ws3-code.md) | T3.1–T3.15 — tests where the code is, closures, pools, nexus |
| [`ws4-agents-surface.md`](ws4-agents-surface.md) | T4.1–T4.11 — authoring, MCP, CLI, skills |
| [`ws5-server-work.md`](ws5-server-work.md) | T5.1–T5.13 — sandbox, runners, load, traces, the cluster |
| [`ws6-product.md`](ws6-product.md) | T6.1–T6.8 — funnel, trust pages, SEO, docs, console |

## 1. Before the first line of code

1. **Read the repository's `AGENTS.md`** — all of it, including "Traps that cost an afternoon each". Every repository
   has one: `plitzi-sdk-server`, `plitzi-workspace`, `nexus`, `plitzi-platform`. It overrides anything here.
2. **Read the finding(s)** your task covers, in the RFC § 3, and the decision (§ 4) if your brief names one. A task
   whose decision is unanswered **does not start**: say so and stop.
3. **Check the portals.** In `plitzi-sdk-server`: `grep -A 20 '"resolutions"' package.json` and
   `ls -ld node_modules/@plitzi/sdk-server` (a symlink is a portal). A task that changes a `@plitzi/*` package *and*
   needs the server to see it needs a portal: **ask the maintainer for it**, never add one yourself.
4. **Make your place to work.** One task, one branch `rfc-0033/<task-id>` (e.g. `rfc-0033/t2-1`), in a **git worktree
   of your own** (`git worktree add ../<repo>-t2-1 -b rfc-0033/t2-1`). The main working trees are shared with the
   maintainer: never `git stash`, `git checkout -- <file>`, `git restore`, `git reset --hard` or `git clean` there.
5. **Run step 0 of your brief and write down what you found** before changing anything. Several findings end in "to
   confirm". If the finding is already fixed or was never true, the task ends with a short note saying what you checked —
   that is a finished task, not a failed one.

## 2. Rules that hold for every task

- **Spanish to the maintainer; English in code, comments, docs, commits and pull requests.**
- **No sub-agents** unless the maintainer said so in this session.
- **Platform ≠ use case.** A WS2 task changes seeds (`plitzi-sdk-server/prisma/seeds/spaces/platform/…`). If the fix
  seems to belong in a package (`plitzi-workspace`), **stop and show the evidence to the maintainer first**. The briefs
  mark the few tasks that are platform changes by design.
- **No legacy shims, no half-moved state.** Change the contract and say what must be redone.
- **Nothing silent.** A refusal names its fix; a write says what it did. A new check comes with its message.
- **A fix carries the test that would have caught it**, and you prove it: run the new test against the code *before*
  your fix once and see it fail. Say in the pull request that you did.
- **Type-safe.** No `any`, no `as` without a comment that says why there is no alternative.
- **Style:** Prettier 120 columns, single quotes, no trailing commas, `arrowParens: avoid`, braces always, a blank line
  after an `if` block and before a `return`. In `plitzi-sdk-server` a relative import names its file (`./x.ts`,
  `./dir/index.ts`). Comments only for a non-obvious *why*.
- **Never delete what was not agreed.** Where a brief says "ask first", ask.
- **Commit, push and release only when asked.** In `plitzi-platform` a push *is* a deploy.
- **nexus:** no change may slow the store (RFC § 3.4.1). Benchmark before and after, every case.

## 3. Which stack, which database

- **Nothing you run touches development's databases** (`project`). Unit tests touch none. `yarn test:e2e` runs on its
  own copies. A browser, a `curl`, a script or a probe goes to the **visual stack**: `yarn visual:up` (it replaces what
  answers on `:443`; `yarn docker:up` brings development's back — do that when you finish, and say you did).
- Verify which stack answers before you probe:
  `docker exec plitzi-api sh -c 'env | grep -E "MYSQL_DATABASE|SESSION_COOKIE_LOCAL"'` — the visual stack says
  `project_test_visual` and `plitzi_auth_test`. If it prints nothing, it is development's: do not probe it.
- **One Playwright run at a time on the machine.** Before starting one: `pgrep -fl @playwright/test/cli.js`. Tasks
  that need the visual stack are taken one after another (the RFC § 7 calls it the visual lane).
- Seeded accounts for the visual stack: `demo`, `admin`, `user`, `elena`, `marcus`, `academy` (password in
  `prisma/seeds/data/users.ts`). Sign in as `demo` for a test, as `admin` only for the back-office.
- A one-off script that needs the repository's packages goes in its git-ignored `tmp/`; delete it when you finish.

## 4. Changing a seed without breaking it

Every WS2 task follows this, in this order:

1. `yarn vitest run prisma/seeds/spaces/platform` — green before you start (if not, stop and say so).
2. Make the change with `sdk-authoring` as the seed already does. **0 warnings and 0 suggestions** from authoring is
   the bar; what is written the same on purpose carries `quiet` and a comment.
3. Remember the traps (`plitzi-sdk-server/AGENTS.md`): a style's `mobile` is laid over `desktop` **alone**, not over
   `tablet` — say a property again in `mobile`; `visible` takes a source, `!source` or `{ source, template }`, never an
   expression; a link whose `href` starts with a template needs `mode: 'external'` or `docsLink(id)`; colour tokens are
   `{ light, dark, default }`; never put a `robots.txt` or `sitemap.xml` in `src/services/ssr/public/`.
4. See it on the visual stack: `yarn visual:up`. It copies the test template, which is rebuilt when migrations or
   seeds change (`E2E_RESEED=1` forces it), so the stack that comes up holds your seed. Do **not** run
   `yarn prisma:seed` or `yarn seed:space` against development's databases to look at your change.
5. **Render diff, not an "after" screenshot.** Snapshot the authored documents and pixel-diff renders of `HEAD` (a git
   worktree) against your tree, for the pages you changed **and** the ones you did not mean to change, in light and
   dark, at 1440, 1024 and 390. Attach what moved.
6. `yarn vitest run prisma/seeds/spaces/platform`, `yarn typecheck`, `yarn lint`, then the visual tests of the page
   (`yarn playwright test visual/website.spec.ts` etc.).

## 5. Done means

In the repository you touched, all green: `yarn typecheck` (in `plitzi-sdk-server`, with
`NODE_OPTIONS=--max-old-space-size=8192` if portals are in place), `yarn lint`, and the tests of what you touched
(`yarn vitest run <path>`; `yarn test:e2e` for routes and resolvers; the visual spec for anything drawn). For anything
drawn: light **and** dark, 1440, 1024 and 390. For a figure the task moves: the figure before and after, measured the
same way, in the pull request. `git status` clean of your leftovers.

## 6. The pull request

Title: `RFC 0033 <task-id>: <what changed>`. Body, in this order:

1. **Finding** — its id and one line.
2. **Step 0** — what you found before changing anything.
3. **What changed** — files and the reason for each.
4. **Proof** — the test that fails without the fix; figures before/after; the render diff.
5. **Not done** — anything the brief asked for that you left, and why. A skipped step is said, never hidden.
6. **To remove from the RFC** — the task's row and brief, and where what it taught now lives (a guide, a comment, a
   line of `AGENTS.md`).

## 7. Stop and ask

Stop, and write to the maintainer, when: a decision of § 4 is unanswered; the fix would change a package for one
seed's sake; something must be deleted that the brief does not name; a test you did not touch fails before you
start; a step would write secrets, change Cloudflare, or touch the live cluster; the same refusal answers you twice;
or what you find contradicts the brief. A brief that turns out wrong is fixed in the brief — say what was wrong.
