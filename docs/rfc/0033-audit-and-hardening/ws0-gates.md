# RFC 0033 — WS0 briefs: gates

Read [`00-how-to-work.md`](00-how-to-work.md) first. Paths are relative to the repository named in each brief.

---

## T0.1 — `xmldom` out

- **Repo:** `plitzi-sdk-server`. **Finding:** G1. **Size:** S.
- **Why:** `xmldom@0.6.0` (unscoped, abandoned) has 1 critical and 12 high advisories and parses HTML users bring in.
- **Read first:** `src/services/transformers/helpers/HtmlParser/HtmlParser.ts` (its only import: `import { DOMParser }
  from 'xmldom'`, used at one `new DOMParser()`); the tests beside `src/services/transformers`; `package.json`
  (`xmldom`, `@types/xmldom`).
- **Steps:**
  1. Step 0: `grep -rn "xmldom" src prisma scripts test` — confirm `HtmlParser.ts` is the only user.
  2. Before changing anything, add a test beside the parser with inputs shaped like the advisories: 5,000 nested
     elements, one element with 5,000 repeated attributes, unclosed tags repeated 5,000 times. Assert each parses (or is
     refused) in under 1 s. Run it on the current code and record the timings.
  3. Replace the dependency with `@xmldom/xmldom` at its latest release (same `DOMParser` API). Remove `xmldom` and
     `@types/xmldom` (the scoped package ships its types). `yarn install`.
  4. If `yarn install` fails with `YN0071`, `yarn dedupe <pkg>` (see AGENTS.md § portals).
  5. Run the transformer tests and your new test.
- **Do not:** swap the parser for a different library (the tree shape the transformer walks would change); loosen the
  new test's bound to make it pass.
- **Verify:** `yarn npm audit --all --recursive --severity high | grep -i xmldom` prints nothing;
  `yarn vitest run src/services/transformers`; `yarn typecheck`; `yarn lint`.
- **Done when:** no `xmldom` advisory; the transformer's existing tests unchanged and green; the new test green.
- **Stop and ask if:** the scoped package parses one of the existing fixtures differently.

## T0.2 — `handlebars` out or current

- **Repo:** `plitzi-sdk-server`. **Finding:** G2. **Size:** S–M.
- **Why:** `hbs@4.4.0` pulls `handlebars` ≤ 4.7.9 (2 critical advisories). It renders the static deploy's page.
- **Read first:** `src/services/deployment/helpers/HandlebarsWrapper.ts`, `src/services/deployment/templates/index.hbs`,
  the two tests under `src/services/deployment`.
- **Steps:**
  1. Step 0: list what the template uses — `grep -n "{{" src/services/deployment/templates/index.hbs`. Note every
     helper, partial, block (`{{#if}}`, `{{#each}}`) and triple-stash (`{{{ }}}`).
  2. Take a snapshot first: a test that renders the template with a fixture and stores the bytes.
  3. If the template only substitutes known fields (no helpers, no partials): write the render as a typed function
     (escaped by default, raw only for the fields that are triple-stash today, each named in a comment) and delete
     `hbs` from `package.json`. Otherwise: depend on `handlebars` directly at a release with no advisory and remove
     `hbs`.
  4. The snapshot must match byte for byte.
- **Do not:** change what the deployed page contains; un-escape a field that is escaped today.
- **Verify:** `yarn npm audit --all --recursive --severity high | grep -iE "handlebars|hbs"` prints nothing;
  `yarn vitest run src/services/deployment`.
- **Done when:** the snapshot is identical and no advisory names `hbs` or `handlebars`.

## T0.3 — The rest of the advisories

- **Repos:** `plitzi-sdk-server`, `plitzi-workspace`. **Finding:** G3. **Size:** S.
- **Steps:** in each repository run `yarn npm audit --all --recursive --severity moderate` and keep the output. For
  each package (`body-parser`, `qs`, `fast-uri`, `ip-address`, `minimatch`, `zod`, `launch-editor`, `eslint`, …):
  `yarn up <pkg>` when a direct dependency; `yarn dedupe <pkg>` when transitive; a `resolutions` entry **only** when
  neither works, with a comment naming the advisory id and the date. Re-run the audit.
- **Do not:** bump a major version of a direct dependency in this task (Express, Apollo, Prisma…): say it in "Not done".
- **Verify:** `yarn npm audit --all --recursive --severity high` exits 0 in both; `yarn typecheck`, `yarn lint`,
  `yarn test` in both.
- **Done when:** no high or critical advisory in either repository.

## T0.4 — Audit in CI

- **Repos:** both (`.github/workflows/deployment.yml`, `.github/workflows/ci.yml`). **Finding:** G4. **Size:** S.
- **Depends on:** T0.1–T0.3 (the job must start green).
- **Steps:** add a job `audit` that installs and runs `yarn npm audit --all --recursive --severity high`. For an
  advisory with no fix, pass `--exclude <advisory-id>` and list it in one file `audit-exceptions.md` at the repository
  root: id, package, why it cannot be fixed, the date to look again. The job fails if that file names an id the
  command no longer needs.
- **Verify:** push a branch that adds a known-vulnerable version to `package.json`; the job fails. Remove it.
- **Done when:** the job is required in both workflows and green on `main`.

## T0.5 — The image says what it was built from

- **Repo:** `plitzi-sdk-server` (and the build of `apps/sdk` in `plitzi-workspace` if a marker must be emitted).
  **Finding:** P0. **Size:** S.
- **Why:** `yarn docker:up` built an image from a development build of the SDK (2,474 KB unminified) and said nothing.
- **Read first:** `scripts/docker-workspace.ts` (it copies each portal's `dist`), `package.json` (`docker:up`).
- **Steps:**
  1. Step 0: with a portal in place (ask for one), run `yarn build:dev` in the workspace and look at
     `node_modules/@plitzi/plitzi-sdk/dist/plitzi-sdk.js`: find what tells a development build from a production one
     without guessing by size. If nothing does, make `apps/sdk`'s build write its mode into a small manifest in `dist`
     (one field), in `plitzi-workspace`.
  2. In `docker-workspace.ts`, before copying a portal's `dist`: read the mode. Development → stop with the fix:
     "`<package>`'s dist is a development build; run `yarn build:prod && yarn build-vendor:prod` in plitzi-workspace,
     or pass `--dev` to build the image from it". With `--dev`: go on and print one line that says so.
  3. Unit-test the check with two fixture manifests.
- **Do not:** silently rebuild the workspace from this script.
- **Verify:** `yarn vitest run scripts`; by hand: `yarn docker:up` over a `build:dev` stops and names the command.
- **Done when:** a development build cannot enter the image unsaid.

## T0.6 — Server CI runs what protects

- **Repo:** `plitzi-sdk-server`. **Finding:** G5. **Size:** L.
- **This is block 3 of the CI plan the maintainer already agreed**, not a new design: e2e in CI with service
  containers (MySQL, Mongo, Redis, SeaweedFS), the visual suite's `@smoke` tests per pull request, the full suite
  nightly and before a release. **Ask the maintainer for that plan's notes before starting.**
- **Depends on:** T0.9 (the tests that fail under load must be fixed first, or CI will be red at random).
- **Rules from that plan:** an unchanged thing is not rebuilt; CI never restores the lint or tsc caches.
- **Done when:** a pull request that breaks a route or the sign-in page fails; the e2e job's time is in the summary.

## T0.7 — A page's budget

- **Repo:** `plitzi-sdk-server`. **Finding:** P5. **Size:** M. **Visual lane.**
- **Read first:** `visual/screens.spec.ts` (the `Screen` type has `wasted?: number`; the comment above says how the
  ratchet works), `visual/helpers.ts` (`capture`, `settle`, `wastedRendersOnLoad`).
- **Steps:**
  1. Add to `visual/helpers.ts` a function that, for a loaded page, returns compressed bytes by kind — script, font,
     document, the space document (`/_plitzi/space/`), style — from Playwright's `request.sizes()`, and the layout
     shift from a `PerformanceObserver` of `layout-shift` installed by `addInitScript` before navigation.
  2. Extend `Screen` with `budget?: { scriptKb, fontKb, spaceKb, documentKb, styleKb, shift }` and assert each
     measured value is ≤ its budget. Set each budget to **today's measured value, rounded up 5 %** — this task changes
     no page.
  3. Write above the table what a budget is and the rule: lowered when beaten, never raised without the reason in the
     diff — the same words as `wasted`.
- **Do not:** measure on a stack that carries a development build (T0.5): the figures would be double.
- **Verify:** `yarn visual:up`, then `yarn playwright test visual/screens.spec.ts`; run it twice — the figures must be
  stable within the 5 %.
- **Done when:** every key screen has a budget; RFC § 5's rows are its first entries.

## T0.8 — Captures that show the page

- **Repos:** `plitzi-sdk-server` (`visual/helpers.ts`, `shoot`), `plitzi-platform` (`cluster/services/screenshot`),
  `plitzi-workspace` (`@plitzi/sdk-mcp`'s capture client: `grep -rn "createLocalScreenshotClient" apps/mcp/src`).
  **Finding:** W17. **Size:** M. **Visual lane.**
- **Why:** a full-page capture leaves everything below the first screens blank (scroll-driven reveals not reached) and
  Chromium paints nothing past 16,384 px.
- **Steps:**
  1. In each of the three capture paths: emulate `prefers-reduced-motion: reduce` for the capture (the reveals are
     behind `@media (prefers-reduced-motion: no-preference)`, so they rest at their end state).
  2. A page taller than 16,000 px is captured in parts of at most 8,000 px (`clip`), each a file `…-01.png`, `-02.png`;
     the gallery (`visual/gallery.ts`) lists them in order. Remove the suite's `MAX_SHOT_HEIGHT` cut once parts exist.
  3. Add a fixture page with an element animated by `animation-timeline: view()` below the fold and assert its pixels
     are not the background's in the capture.
- **Do not:** scroll the page to trigger reveals (slower, and sticky elements repeat in every part).
- **Verify:** the suite's `website-home-guest` capture shows the footer; the fixture's test.
- **Done when:** the three capture paths behave the same and say so in one shared comment.

## T0.9 — The tests that need a quiet machine

- **Repo:** `plitzi-sdk-server`. **Finding:** G6. **Size:** M.
- **Read first:** `test/e2e/resilience/job-queue.e2e.test.ts`; in `visual/`: `auth.spec.ts:336` (wrong current
  password), `examples.spec.ts:614` (Inkwell's Studio), `pizarra.spec.ts:1666` (a tracker).
- **Steps:**
  1. Reproduce: run the e2e file while a second `yarn test:e2e` runs (or under a CPU hog). Record which of its tests
     fail and with what message (the audit saw: `expected +0 to be 6`, `expected 'pending' to be 'succeeded'`, an
     assertion on `undefined`, `expected [] to have a length of 1`).
  2. For each: find the wait that is wall-clock (`setTimeout`, a fixed `sleep`, a deadline in ms) or the read made
     before the queue says it settled. Replace it with a wait on the queue's own state (poll the record until its
     status, with a generous bound), or inject the clock where a deadline is the subject.
  3. The three visual tests: each fails on a timeout under load; give the step its own wait on the element it needs
     (`settle`, then an explicit `expect(...).toBeVisible`), not a longer global timeout.
- **Do not:** raise timeouts as the fix; add retries; mark tests `skip` or `fixme`.
- **Verify:** twenty full `yarn test:e2e` runs in a row, each beside a second run, all green (script it; keep the log
  in `tmp/logs/`); the three visual tests ten times each beside the full suite.
- **Done when:** the cause of each is named in the pull request and the runs are green.

## T0.10 — Every route names its guard

- **Repo:** `plitzi-sdk-server`. **Finding:** G7. **Size:** S.
- **Read first:** `src/services/api/index.ts` (the mount table; `authMiddleware(apiAuthPolicy, 'error')` and
  `originGuard('error')` are global), `src/services/auth/index.ts` (the guards: `requireSpacePermission`,
  `requireWorkspaceMember`, `requireSpaceMember`, `requirePermission`, `requireCapability`, `authenticated`).
- **Steps:**
  1. Write a test that walks the routers from `src/services/api/index.ts` (follow `router.use('/prefix', child)`),
     lists every `router.<method>('<path>', …)` and asserts each either names a guard in its declaration, is under a
     `router.use(<guard>)` or a guarded mount, or is in a `PUBLIC_ROUTES` list **with a reason per entry** (the
     collector, the billing webhook — signature inside, the fonts catalogue, an invitation by its token, the runtime's
     bundle — its own secret).
  2. The ten routes that check `req.user` by hand (`account/index.ts`, `devices/index.ts`, `profile/index.ts`) take
     the `authenticated` guard; remove the hand-written `if (!userId) return res.status(401)…`.
- **Do not:** change what any route answers; `/spaces/:spaceId/...` routes use `requireSpacePermission` or
  `requireSpaceMember`, never `requirePermission` + `requireSpaceMember` (AGENTS.md).
- **Verify:** the test; `yarn test:e2e` (the routes' own suites); add a throw-away route with no guard and see the
  test fail, then remove it.
- **Done when:** the test is in the unit run and the allow-list has a reason on every line.

## T0.11 — A new project installs clean

- **Repo:** `plitzi-workspace` (`apps/cli/src/scaffold`). **Finding:** G8. **Size:** S.
- **Steps:** make a project (`node apps/cli/dist/bin.js create /tmp/<dir> --mode server --source local
  --package-manager npm`), run `npm audit` in it, and move the scaffold's dependency ranges (or add `overrides` the
  scaffold writes) off each advised version. Add a nightly check (not per pull request — it needs the network) that
  makes a project and runs `npm audit --audit-level=moderate`.
- **Verify:** a fresh `create` ends with no advisory line.
- **Done when:** the nightly check exists and passes.

## T0.12 — The edge leaves the HTML alone

- **Repos:** `plitzi-platform` (Cloudflare role), `plitzi-sdk-server` (a check), `plitzi-workspace` (`docs/en`).
  **Findings:** W33, W34. **Size:** S.
- **Why:** on the dev cluster Cloudflare's email obfuscation rewrites addresses in the HTML and injects a script the
  page's policy blocks; React then fails hydration (#418) and redraws the page.
- **Steps:**
  1. **Ask the maintainer's go** — this changes Cloudflare. Then turn Email Address Obfuscation off for the zones the
     platform serves, in the Ansible role that manages Cloudflare (`cluster/ansible/roles/`; find it:
     `grep -rln "cloudflare" cluster/ansible/roles`).
  2. In the visual suite's remote mode (`VISUAL_SSR_URL` set): a test that loads `/` and `/terms` and asserts the
     console holds no message matching `/Minified React error #418|Content.Security.Policy/`.
  3. A paragraph in the self-hosting guide (`docs/en`) for whoever puts a rewriting proxy in front of a space.
  4. Measure again as a throttled phone (CPU ×4, 1.6 Mbps): `/terms` and `/templates`' largest paint.
- **Verify:** no #418 on `dev.plitzi.com`; `/terms`' largest paint under 2.5 s in that lab.
- **Stop and ask if:** the role has no setting for it — do not click it in the dashboard.

## T0.13 — The CSRF token, asked

- **Repos:** `plitzi-sdk-server` (`src/services/api/index.ts`, `src/services/auth`), `plitzi-workspace`
  (`packages/sdk-kernel/src/identity/csrf.ts`, and whatever in the SDK sends the header). **Finding:** S1.
  **Decided (D12): the API asks for the token** on every write carried by a session cookie; a bearer is exempt; the
  origin check stays as the second lock. **Size:** M.
- **Why:** the kernel's text says a token is "demanded whenever a session cookie is present"; `PATCH /profile` with
  the cookie and no token, a wrong token or no CSRF cookie reaches its handler. Only the origin check refuses. The
  token is what protects a deployment that sets `SameSite=None` (a space embedded in another site).
- **Steps — in this order; enforcing first would sign people out of their own console:**
  1. Step 0: find why it is not asked. Read how `originGuard` (server) uses the kernel's CSRF
     (`grep -rn "csrf\|Csrf" src/services/auth src/services/api/index.ts`), and which `CsrfSubject` it checks.
  2. **Inventory every first-party caller** that writes with the session cookie, and whether it sends
     `x-csrf-token` today: the `website` seed's flows and providers (`{{apiUrl}}` calls with `credentials: 'include'`),
     the `auth` seed's flows, the console's pages, the builder (GraphQL to the server role — check whether it uses a
     bearer), the dev tools. Capture it from the visual suite: run it with the server logging, for each
     cookie-carried write, whether the header was present. A table in the pull request.
  3. Make every caller that does not send it send it — in the one place the SDK attaches credentials, not per flow.
  4. Then enforce: a cookie-carried write with no token, a wrong one or one bound to another session is refused, in
     words that name the fix; a request with `Authorization: Bearer` is never asked.
  5. The e2e, nine cases: own origin with token (passes), without, with a wrong one, without the CSRF cookie (each
     refused); a space's origin of the same site with and without (refused by the origin check); no origin and no
     token (refused); a foreign `Referer`; a form-encoded post.
- **Do not:** enforce before step 3 is green; exempt a route to make a test pass — a route that must be exempt (a
  webhook, the collector) carries no session and is listed with its reason; add a shim that accepts both for a while.
- **Verify:** the new e2e; `yarn test:e2e` whole; **the whole visual suite** (`yarn visual`) — every signed-in journey
  writes; the builder saving a change on the visual stack; `plitzi login` and `plitzi space push` (bearer) still work.
- **Stop and ask if:** a first-party caller cannot send the header (a plugin from a CDN, a form post) — say which.

## T0.14 — A throttle a stranger cannot use

- **Repo:** `plitzi-workspace` (`apps/server/src/core/auth/throttle.ts`, `…/api/session.ts:78`), wired in
  `plitzi-sdk-server`. **Finding:** S2. **Size:** M.
- **Why:** sign-in is limited by the username alone (10 in 5 min, per replica's memory): a stranger locks an account
  out, and one password tried over many usernames is never slowed.
- **Steps:**
  1. Count two things apart: failures **from an address** (any usernames) and failures **for an account from an
     address**. An account's limit refuses only the addresses that failed; its owner signs in from another.
  2. The address comes from the request's carrier as the kernel already resolves it behind a proxy
     (`grep -rn "carrier" packages/sdk-kernel/src/identity`); never read `x-forwarded-for` yourself.
  3. The counters behind the seam the kernel has for a shared store; the hosted platform passes Redis (keys through
     `src/services/redis/cacheKeys.ts` — AGENTS.md).
  4. Clocks injected in the tests.
- **Verify:** tests: ten failures from address A do not refuse the right password from address B; one password over
  fifty usernames from A is refused from the limit on; a window passing lets A in again. `yarn test` in the
  workspace, `yarn test:e2e` in the server.
- **Do not:** lock an account for everyone; trust a client-sent address.

## T0.15 — Small doors

- **Repo:** `plitzi-sdk-server`. **Findings:** S3, S4, S5, S6. **Size:** S.
- **Steps:**
  1. **CORS:** `src/services/express/index.ts` answers any `Origin` with itself. Answer `Access-Control-Allow-Origin`
     only for the deployment's own origins (the list the origin guard uses), with `Vary: Origin`; nothing for others.
     Check the public endpoints that must answer any origin (the analytics collector, `/_plitzi/…` on a space's host)
     keep doing so — they are separate mounts.
  2. **GraphQL:** measure the builder's largest real query (depth, aliases) from its source
     (`apps/builder/src` — `grep -rn "gql\`"`), then set a depth and alias limit above it in
     `src/services/graphql/index.ts`, refused with a message that names the limit.
  3. **Names:** workspaces, teams and spaces refuse a name over 80 characters or holding `<`, `>` or a control
     character, with the fix in the message — one shared validator.
  4. **Ids:** a space id past the integer's range answers 404 like any unknown id, not 500
     (`GET /spaces/99999999999999999999`).
- **Verify:** four e2e tests, each failing before the change; `yarn test:e2e`.
