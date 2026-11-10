# RFC 0033 — WS0 briefs: gates

Read [`00-how-to-work.md`](00-how-to-work.md) first. Paths are relative to the repository named in each brief.

---

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
- **Do not:** measure on a stack that carries a development build (the image now refuses one unless `PLITZI_DEV_BUILD=1`): the figures would be double.
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
