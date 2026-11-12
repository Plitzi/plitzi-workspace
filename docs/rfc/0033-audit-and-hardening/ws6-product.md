# RFC 0033 — WS6 briefs: product

> Section numbers here are the full RFC's, `git show c29db583b:docs/rfc/0033-audit-and-hardening.md`: its § 3 holds the
> findings, § 4 the decisions (§ 2 now), § 8 the design notes (§ 4 now). A task named here that is no longer in the RFC
> has shipped: what it made is in the code.

Read [`00-how-to-work.md`](00-how-to-work.md) first, and for T6.5–T6.7 the RFC § 3.1.3 — its table is what these
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

- **Finding:** X5. **Size:** L. WS1 has shipped (the space in parts, the heavy pages said): it can start.
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
     ("one document, three ways in"); the brand's own icons as a sprite.
- **Do not:** invent a customer, a number or a quote; raise the home's weight above its budget (T0.7).
- **Verify:** each new page in the sitemap and linked from the bar or the footer; both themes; every width of T2.28;
  authoring at 0 warnings and 0 suggestions.

## T6.6 — Found by a search

- **Source:** RFC § 3.1.3 (SEO), W30. **Size:** S.
- **Steps:** a share image per page made at publish (a template's cover, a doc's title on the brand's ground) is general
  — every customer's space could have it — so it is a platform change: show the evidence to the maintainer first.
  `/templates` says its `ItemList` (its gallery asked on the server, the category in the address).
- **Verify:** each page type's share image in its head; `yarn vitest run prisma/seeds/spaces/platform`.

## T6.7 — Docs for both readers: the REST reference

- **Source:** RFC § 3.1.3 (Docs). **Size:** M.
- **Waits on:** the maintainer's word on § 5 — the API declares its routes, or the REST reference leaves T6.7.
- **Steps:** if the routes are declared — path, method, guard, a sentence, the body — a reference page written from
  that table when the docs are seeded, as `shell/mcpTools.ts` writes the MCP's from its tools; never by hand.
- **Do not:** walk the Express routers for it (`routeGuards.test.ts` does, for guards): it has no word for a reader and
  would teach internal routes as a public surface.
- **Verify:** `yarn vitest run prisma/seeds/spaces/platform/docs` — a route added is on the page.
