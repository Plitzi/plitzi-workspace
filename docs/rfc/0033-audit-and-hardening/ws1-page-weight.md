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

**Order:** T1.1 measures and writes the two contracts; nobody starts T1.2, T1.3 or T1.4 before T1.1's note is in the
RFC § 8. T1.2 and T1.3 are worked by different agents who read each other's part
of § 8. All of WS1 needs portals from `plitzi-sdk-server` to `plitzi-workspace`: ask for them.

**The net for every WS1 task:** `visual/screens.spec.ts`'s `wasted` budgets must not rise; the flicker and theme tests
of `visual/website.spec.ts` stay green; T0.7's byte budgets go down, never up; and a load must not draw late an
element that was drawn at once before.

**How to measure, always the same way:** a production build (`yarn build:prod && yarn build-vendor:prod` in the
workspace), the page server alone with `NODE_ENV=production` (`plitzi-sdk-server/AGENTS.md` § "A page links the
space's stylesheet" says how), compressed bytes from the browser's network (`request.sizes()`), three runs. Never the
watch server, never a development build.

---

## T1.2 — The space document in parts

- **Repos:** `plitzi-workspace` (`apps/server`, `apps/sdk`, `packages/sdk-schema`). **Finding:** P1. **Size:** L.
- **Depends on:** T1.1. **Decided:** D1, D2 (above). **Contract:** RFC § 8, contract A — follow it; if it is wrong,
  fix § 8 first.
- **Steps:**
  1. Server: `spaceDocument.ts` builds a **shell** (definition, settings, variables, flags, the page list with slug
     and access level, what every page needs), **one part per layout** (its subtree and the components it uses) and
     **one part per page** (its subtree, the components only it uses, and the names of the layouts it needs). Each is
     named by a hash of its content and served immutable, like the stylesheet.
  2. The page server puts the rendered page's part **and its layouts' parts** in reach of the first paint (inlined or
     preloaded — § 8 says which) so the first load makes no extra round trip.
  3. Client, **with a page server only**: `navigation.navigate` fetches the target page's part and any layout part it
     does not hold; a link that enters the viewport prefetches both (idle priority). A layout already held is never
     fetched again. Navigation stays free of the API — a part is a static file — and a part that fails to arrive falls
     back to a full page load, said in the dev tools, never a blank page.
  4. **The SDK alone, with no page server (D1): nothing changes.** A space rendered as a single-page app keeps
     receiving the whole document through the request it makes today, and navigates within it as today. Do not make
     that path fetch parts, and do not change what `/_plitzi/space.json` or the public `Space` query answer. Find every
     such path first: `grep -rn "space.json\|query Space\|Space(" apps/sdk/src packages/sdk-shared/src examples`.
  5. Access (D2): a guarded page's part is served as the page is — the same check as the page's own request. A
     visitor not signed in gets 401/404 for it, and the shell's page list tells it only what it needs to route (slug,
     access level), not the page's content. A layout used only by guarded pages is guarded the same way.
  6. A setting keeps today's whole document for a space that asks. The builder and the MCP keep reading the whole,
     through their own paths — do not route them through parts.
- **Do not:** change the schema's stored shape; break `invalidateSpaceCaches` (a write must drop the shell, the parts
  and both page caches — read AGENTS.md § "A published page is kept in Redis too"); add a proxy/CDN rule without the
  same for the new path (AGENTS.md § "A page links the space's stylesheet").
- **Verify:** unit tests of the split (a page's part plus the shell reassemble to the whole, for every seeded space —
  reuse `compareSpaces`, expanding component instances first); e2e: a visitor not signed in cannot fetch a guarded
  page's part; `yarn playwright test visual/screens.spec.ts` with `wasted` unchanged; T0.7's `spaceKb` for `/terms`
  ≤ 25 KB plus the page's own; a navigation between two public pages that share a layout makes one request under
  30 KB. **For D1:** the workspace's e2e of the client-only projects and examples (`yarn e2e:ci`) unchanged and
  green, and the requests such a project makes are the same list as before (record both); navigation between two
  pages, with a page server, no slower than T1.1's figures at the median and at p95, and with no loading state that
  was not there — a test that fails if a spinner or an empty frame is painted between two pages.
- **Stop and ask if:** a seeded space reads another page's elements at runtime (a binding across pages) — the split
  must not break it silently; or the SDK-alone path cannot be left untouched without two code paths you cannot test.

## T1.3 — The SDK in parts

- **Repos:** `plitzi-workspace` (`apps/sdk`, `packages/sdk-elements`, `apps/server`). **Finding:** P2. **Size:** L.
- **Depends on:** T1.1. **Contract:** RFC § 8, contract B.
- **Steps:**
  1. A **core** chunk: the store, navigation, auth, interactions, and the elements § 8 lists as everywhere.
  2. **One chunk per heavy element or family** (chart, the form controls, tabs, list, markdown, map, …), named by
     content, loaded through the element registry's own lazy path. The dev tools stay their own chunk, as today.
  3. The page server writes `<link rel="modulepreload">` for the chunks of the element types it rendered, so
     hydration finds them already fetched. Its `103 Early Hints` include them (AGENTS.md § "The page server answers
     103 Early Hints").
  4. A space's own plugins keep the import map they have (`react`, `react-dom`, the JSX and compiler runtimes,
     `@plitzi/plitzi-sdk`): a plugin's value import of the SDK must keep resolving to one copy.
  5. The server-side render imports the same registry — no element may render on the server and be missing in the
     browser.
- **Do not:** make an element render late that rendered at once (the flicker check); duplicate React or the store in
  two chunks (AGENTS.md § "The image and `yarn start` run the roles' bundle" — one copy of each); change
  `plitzi-sdk-vendor.js`'s contents without measuring.
- **Verify:** `yarn check:dist-exports`, `yarn check:specifiers`, `yarn check:server-footprint` in the workspace; the
  workspace's e2e (`yarn e2e:ci`); in the server, `yarn playwright test visual/` whole; hydration time of the
  signed-in dashboard before and after (three runs, production); T0.7's `scriptKb` for `/terms` ≤ 150 KB.
- **Stop and ask if:** a chunk boundary forces a plugin's bundle format to change.

## T1.7 — A heavy page is said

- **Repos:** `plitzi-workspace` (`packages/sdk-authoring`), then `plitzi-sdk-server` (the pricing seed).
  **Finding:** P1's per-page figures. **Size:** M.
- **Steps:**
  1. Authoring: a **suggestion** (not a refusal) when one page's authored subtree passes 250 KB of document, naming
     the three largest repeated shapes (the existing advice for repeats — `packages/sdk-authoring/src/schema/advice/repeats.ts`
     — shows how repeats are found). It needs a code in `src/schema/codes/`, its row in the generated errors page
     (`yarn generate:authoring-errors`), and a test.
  2. The pricing page (`prisma/seeds/spaces/platform/website/landing/pricingPage.ts`, 691 KB authored): its plans,
     capacity packs and comparison rows are written out per state. Author them from data — `services/pricing` is the
     one place for the figures — through a `list` and components, so the document holds one row's shape.
- **Do not:** change a pixel of `/pricing` (render diff, both themes, 1440/1024/390); change a price; duplicate a
  figure outside `src/services/pricing`.
- **Verify:** `plitzi lint` (or the seed's own authoring test) reports the suggestion for the pricing page before
  step 2 and not after; the page's part under 200 KB; `yarn vitest run prisma/seeds/spaces/platform`;
  `yarn playwright test visual/website.spec.ts` (the pricing configurator's test).
