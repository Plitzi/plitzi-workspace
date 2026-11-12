# RFC 0033 — WS1 briefs: page weight

> Section numbers here are the full RFC's, `git show c29db583b:docs/rfc/0033-audit-and-hardening.md`: its § 3 holds the
> findings, § 4 the decisions (§ 2 now), § 8 the design notes (§ 4 now). A task named here that is no longer in the RFC
> has shipped: what it made is in the code.

Read [`00-how-to-work.md`](00-how-to-work.md) first. **These are platform changes by design** (RFC § 3.2): every space
gains. The evidence the maintainer asked to see first is the RFC's table for `/terms` — 0.9 MB for 9 KB of content.

**Decided (RFC § 4, 2026-11-10) — these bind every WS1 task:**

- **D1:** a page's part may be fetched on navigation, on three conditions. (1) A page brings its **layouts**, which
  are parts of their own — several pages share a layout, so it is fetched once and kept. (2) **A space rendered by the
  SDK alone, as a single-page app with no page server, must not change at all**: it keeps receiving the document
  exactly as today (a project made with `plitzi create --mode client`, the self-hosting examples that render in the
  browser, anything that reads `/_plitzi/space.json` or the public `Space` query). (3) **Navigation must not get worse
  where there is a page server either**: no wait a visitor can see that is not there today.
- **D2:** a visitor who is not signed in does not receive the structure of pages that need a session.

**Order:** T1.1 measures and writes the two contracts; nobody starts T1.2 or T1.4 before T1.1's note is in the
RFC § 8. T1.2 is worked by an agent who reads the contract
of § 8. All of WS1 needs portals from `plitzi-sdk-server` to `plitzi-workspace`: ask for them.

**The net for every WS1 task:** `visual/screens.spec.ts`'s `wasted` budgets must not rise; the flicker and theme tests
of `visual/website.spec.ts` stay green; T0.7's byte budgets go down, never up; and a load must not draw late an
element that was drawn at once before.

**How to measure, always the same way:** a production build (`yarn build:prod && yarn build-vendor:prod` in the
workspace), the page server alone with `NODE_ENV=production` (`plitzi-sdk-server/AGENTS.md` § "A page links the
space's stylesheet" says how), compressed bytes from the browser's network (`request.sizes()`), three runs. Never the
watch server, never a development build.

---

## T1.7 — A heavy page is said

- **Repos:** `plitzi-sdk-server` (the seeds), `plitzi-workspace` if § 5 says the steps are stored compact.
  **Size:** M each.
- **Waits on:** the maintainer's word on the RFC's § 5, "The 250 KB line and an app's page".
- **Where it stands (11-12):** authoring's `heavy-page` names three pages, and none for a shape written again any
  more. Pizarra's board went 1,670 → 990 KB: its 21 popovers were a flag each, so closing them all was 21 steps in
  every tile, key and button (2,172 steps, 575 KB) — now one key, `panel` (`space/panels.ts`); its favourites drew
  every tile a second time with its steps (323 KB) — now a `reference` to the category's tile. What is left on the
  board, the monitor and the home is how many elements each has (`tmp/` weighing: by field, steps are half).
- **Steps,** by the decision: a page's kind in the line (authoring), the steps stored compact (sdk-shared, the
  builder, a migration), or `quiet: ['heavy-page']` with why on each app page. The home's hero mock as a picture is a
  redesign of the landing (T6.5's lane).
- **Do not:** split an app's page into pages to pass the line; change a pixel of a seed (render diff, both themes).
- **Verify:** `plitzi lint` (or the seed's authoring) names none of the three, or each says why;
  `yarn vitest run prisma/seeds/spaces/showcase/pizarra`; `visual/pizarra.spec.ts`.
