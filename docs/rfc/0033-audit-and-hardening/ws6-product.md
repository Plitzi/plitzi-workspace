# RFC 0033 — WS6 briefs: product

> Section numbers here are the full RFC's, `git show c29db583b:docs/rfc/0033-audit-and-hardening.md`: its § 3 holds the
> findings, § 4 the decisions (§ 2 now), § 8 the design notes (§ 4 now). A task named here that is no longer in the RFC
> has shipped: what it made is in the code.

Read [`00-how-to-work.md`](00-how-to-work.md) first, and for T6.5–T6.8 the RFC § 3.1.3 — its table is what these
tasks build. Repository: `plitzi-sdk-server` unless said. Seed work follows `00-how-to-work.md` § 4 and takes the
visual lane. These land **after** the faults of WS2: polish over a broken bar is wasted.

Rules that matter here: a strong brand, no white-label; warnings calm (amber and plain words, never alarm); a website
page explains the product to a user and restates a rule the skills own in one line, in their words; one owner per
fact — a price comes from `src/services/pricing`, a plan's limit from the plans, never retyped on a page.

---

## T6.1 — The funnel

- **Finding:** X2. **Size:** M.
- **Read first:** `docs/beta-onboarding.md` (activation is defined once: *published to an address that works AND
  edited again within 7 days*), `prisma/seeds/spaces/platform/website/pages/admin/overview.ts`,
  `src/services/api/admin/` (the overview's API), `docs/back-office.md`.
- **Steps:** Step 0: what the overview shows (People, Money, Moderation, health) and which events the platform already
  records with a time (sign-up, confirmation, a space created, a publish, a later edit). Add, from those and nothing
  new: signed up → confirmed → first space → first publish → edited again within 7 days, by week of sign-up, with the
  median time between steps. Backend in UTC. If a step has no recorded time, say which and stop.
- **Do not:** add tracking of people beyond what is recorded; count Plitzi's own seeded workspaces (the Money page
  already excludes them — use the same rule).
- **Verify:** `yarn test:e2e` for the route (staff only: `hiddenWithout('adminManage')`); the back-office's visual
  test on seeded data; one `includes` check — count the route's SQL statements before adding a relation loop.

## T6.4 — A page's weight, shown to its owner

- **Finding:** X5. **Size:** L. **After WS1.**
- **Steps:** a design note first (in the pull request, for the maintainer): what to measure per page (bytes by kind
  from the page server, layout shift and largest paint from the collector the page already loads), how it is stored
  beside the existing analytics (`src/services/api/analytics/`), what it costs per view, and the screen. Build only
  after the note is accepted.
- **Do not:** trust a number the browser reports for billing — this is not billing; meter nothing new server-side.

## T6.5 — The landing says who and proves it

- **Source:** RFC § 3.1.3 (Landing). **Size:** L. **After T2.1, T2.4, T2.24, T2.25, T2.28.**
- **Steps:**
  1. The first screen names its reader (studios and agencies that keep other people's sites — confirm the wording
     with the maintainer) and uses the docs' sentence for what Plitzi is.
  2. A second, quieter call to action beside **Start free**: a 90-second recording of the studio, or an address kept —
     a real form on the platform's own actions, not a mock.
  3. Proof that exists today in place of the star count (sites live, the licence, the open repository); a slot for
     two studios' words, filled when the beta gives them — never invented.
  4. A page per reader (agencies, developers, marketing) and honest comparisons (Webflow, Framer, WordPress with a
     page builder, a headless CMS), each from one shared frame and one data module, so a claim is written once.
     A comparison says where the other is better.
  5. Art: alternate the bands' mock-ups with one full-bleed picture of a real seeded site and one drawn diagram
     ("one document, three ways in"); the brand's own icons as a sprite (with T1.4).
- **Do not:** invent a customer, a number or a quote; raise the home's weight above its budget (T0.7).
- **Verify:** each new page in the sitemap and linked from the bar or the footer; both themes; every width of T2.28;
  authoring at 0 warnings and 0 suggestions.

## T6.6 — Found by a search

- **Source:** RFC § 3.1.3 (SEO), W30. **Size:** S.
- **Shipped (11-12):** `FAQPage` (the home's questions), `Product`/`Offer` per plan, the showcase's `ItemList`, the
  docs' `TechArticle` + `BreadcrumbList`, docs' descriptions from the lede and the page's own prose (≤ 160), a share
  image for the docs (the large card) and the website's redrawn with the layers mark.
- **Left:** `ItemList` on `/templates` — its gallery is read in the browser (`landing/sections/templates.ts`), so the
  head has nothing to write it from: a `runtime: 'server'` provider first, keeping the room its `loadingSlot` holds. A
  share image per page made at publish (a template's cover, a doc's title on the brand's ground) is general — every
  customer's space could have it — so it is a platform change: show the evidence to the maintainer first.
- **Verify:** a structured-data validator green on each page type (in a test: parse the JSON-LD and check its
  required fields); `yarn vitest run prisma/seeds/spaces/platform`.

## T6.7 — Docs for both readers

- **Source:** RFC § 3.1.3 (Docs). **Size:** L.
- **Read first:** `docs/public-docs.md`, `prisma/seeds/spaces/platform/docs/shell/nav.ts` (`DOCS_TABS`),
  `shell/uiNames.ts` (`ui(…)`, `site(…)` — every builder button named as the builder shows it; `uiNames.test.ts`
  checks them against the installed `@plitzi/*` `dist`).
- **Steps:** a reference part for whoever builds in the builder and never opens the code (its panels, the inspector,
  publishing and snapshots, domains, people and plans) — the Academy teaches it; no reference holds it. Every page
  gains "Copy as Markdown" and "Edit this page"; "Was this useful" with one field; searches with no result are kept
  and listed for whoever writes. The REST routes and the MCP's tools as generated reference pages (from the route
  table and the tool definitions, never by hand).
- **Do not:** paste code into a lesson (the Academy's code is read from Café Lumen's project by `lessonFile`); name a
  builder button in plain bold (`ui(…)`); teach a permission name with a dot.
- **Verify:** `yarn vitest run prisma/seeds/spaces/platform/docs` (imports resolve, links exist, the catalogue is
  whole); `visual/docs.spec.ts`; a page's Markdown is what an agent receives.

## T6.8 — A console that walks you in

- **Source:** RFC § 3.1.3 (Console). **Size:** L.
- **Read first:** `prisma/seeds/spaces/platform/website/homeChecklist.ts` (the checklist exists),
  `pages/home-authenticated.ts`, `pages/homeSpacesRows.ts`, the dashboard's layout rules in the maintainer's notes.
- **Steps:** the first run leads to the first publish — the checklist as the home's main thing until it is done, each
  step ticking; renaming a space in place; acting on several spaces at once; one shared way to sort and page every
  table; a count of what needs attention on the bar; loading drawn at its final size (with T2.14).
- **Do not:** add a state key the server does not paint and expect it on reload (AGENTS.md § painted state); write a
  flow's bare `{{spaceId}}` inside a list's row (use `{{ navigation.routeParams.spaceId }}`).
- **Verify:** T6.2's journey is shorter; the tables' behaviour lives in one component; `visual/website.spec.ts`.
