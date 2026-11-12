# RFC 0033 — Audit and hardening: what is left

Status, 2026-11-11: most of the audit has shipped. This file keeps **only the work still open** and what it needs to
be done. The audit's findings (W…, DS…, S…, Q…, A…, R…, PL…, X…, RS…), its method and every task already shipped are
in this file's history — `git show c29db583b:docs/rfc/0033-audit-and-hardening.md` — and in the commits that name
"RFC 0033". The procedure every task follows is unchanged:
[`0033-audit-and-hardening/00-how-to-work.md`](0033-audit-and-hardening/00-how-to-work.md).

## 1. Targets still open

Each is a test that ratchets: lowered when beaten, never raised.

| Target | Now | After | Task |
|---|---|---|---|
| JavaScript for a page of text (compressed) | ~330 KB (`screens.spec.ts` budgets) | No split (D13): any saving is made inside `plitzi-sdk.js` | — |
| Space document for a public page of the website (compressed) | 24 KB on `/terms`, 86 KB on the home (2026-11-12; 130 and 115 before) | ≤ 25 KB + the page's own — met | T1.2 |
| Home height at 390 px | 16,847 px (ratchet 16,900; 15,991 before every control stood 44 px) | ≤ 16,000 px | T2.4′ |
| Controls outside the window, 768 to 1280 px | the bar holds from 320 to 1440; the sweep of the key screens is not written | none, at seven widths | T2.28 |
| Controls under 44 px on a phone | 0 on every key screen but the home's 2 (the studio's billing toggle, 43 px after a capture scrolled the page; 44 at rest) | 0 | T2.4′ |
| Server CI | lint, types, unit; the e2e job written, never run on GitHub | + e2e, + visual `@smoke` | T0.6 |

## 2. Decisions the open work still reads

Answered by the maintainer on 2026-11-10.

| # | Question | Decided |
|---|---|---|
| D1 | May a page's part of the space document be fetched on navigation? | **Yes, with three conditions.** A page brings its **layouts**, which are parts of their own (several pages share one). **Rendering with the SDK alone, as a single-page app with no page server, must not change at all** — it keeps receiving the document as it does today. And **navigation must not get worse where there is a page server either**: no wait a visitor can see that is not there today |
| D2 | Does a visitor who is not signed in receive the signed-in pages' structure? | **No** |
| D8 | Seeds of the showcase in a package of their own | **No** (2026-11-11): `prisma/` sits outside `src/` on purpose; the cold figures (typecheck 18.3 → 12.6 s, lint 63.4 → 41.5 s) are not worth a package |
| D11 | Which mark is the brand's | **The home's** — the stacked layers. The console, the back-office and the builder take it |
| D13 | Is the SDK split into chunks loaded per element family (T1.3)? | **No** (2026-11-12): the SDK is always one file, `plitzi-sdk.js` — it is also used as an SPA, loaded by name wherever a space is hosted. Its weight is cut inside it, never by splitting it (the dev-tools chunk, loaded only to debug, stays) |

## 3. Work left

What each row says is what is left of it; what shipped of it is in the history.

### WS0 — Gates

| Task | Left | Done when | Size |
|---|---|---|---|
| **T0.6** The visual suite in CI | The e2e job's first run on GitHub (written 2026-11-10, required by `build-app`), its time in the summary; the visual suite's `@smoke` per pull request, the full one nightly and before a release (block 3 of the CI plan) | A pull request that breaks the sign-in page fails | M |
| **T0.12** The edge leaves the HTML alone | Email obfuscation off in every zone: committed in `plitzi-platform`'s Cloudflare role, **not applied — the API token lacks `Zone · Zone Settings : Edit`** (the maintainer's to grant, or turned off by hand); then the visual suite's remote check that a page's console holds no hydration error and no refused script, and the lab pass of `/terms` and `/templates` | No #418 and no blocked script on `dev.plitzi.com`; `/terms`' largest paint under 2.5 s in the lab | S |

### WS1 — Page weight

| Task | Left | Done when | Size |
|---|---|---|---|
| **T1.2** The space document in parts | Shipped 2026-11-12 (shell + a part per page and layout, D1/D2, prefetch, the session changing on the page). Left: navigation timed against T1.1's figures at p50 and p95 — it is held to no blank frame and the same document, not yet to a time; a switch for `settings.wholeDocument` in the builder's General settings (the builder keeps the setting already) | The two figures no worse than T1.1's; the switch drawn in both themes | S |
| **T1.7** A heavy page is said | `space-record` done (300 → 247 KB, 2026-11-12: its capacity as lists and computed values; Pools left the list as five pages). Left, each a page rewritten rather than trimmed — measured 11-12: `home-guest` 527 KB over 1,423 elements, spread across the landing (the hero's studio mock 175, the capabilities 79, the comparison 60, the doors 54, collaboration 46); Meridian's `monitor` 454; Pizarra's `page-2` 1,670, its library writing every tile twice (the favourites and the category), each with its own flows. Since T1.2 a visitor downloads the page's part alone (the home's: 86 KB compressed), so the line is what a page weighs, not what every visitor pays for the whole site | `plitzi lint` names none of them | M each |

### WS2 — Website and sign-in (one visual lane)

| Task | Left | Done when | Size |
|---|---|---|---|
| **T2.4′** The home on a phone, looked at | The maintainer's look on a phone — the rails of § 02–07 and § 01's moment-then-picture shipped 2026-11-11, "looked at on a phone before it is called done". The height back under 16,000 px without the 44 px targets giving way (they cost ~850 px: the footer's links, the studio's controls); the studio's billing toggle at 44 after a capture | § 1's two rows | S |
| **T2.10** The sign-in pages, finished | One vertical rhythm for every sign-in page on a phone (`/sso` and `/forgot-password` centre where `/` and `/signup` start at the top); a share image and descriptions of a useful length | `auth` tests and the visual journey | S |
| **T2.16** Landmarks | Authoring's suggestion for a page without `main`, once every seed — the demos' and showcases' — carries one | The lint says it; every seed passes | M |
| **T2.17** Sign-in, said to everyone | **After the release that carries `autoComplete` tokens**: the auth seed names `username`, `new-password` and `one-time-code`; a focus ring on the fields, measured in both themes | The attributes asserted; the ring's contrast at 3:1 | S |
| **T2.18** `llms.txt` and the sitemap | **After the release that carries `blockAiCrawlers` by kind**: the website seed leaves it out, the docs' routing page says the list. An `llms.txt` for the website and the docs; the sitemap with each template and showcase chapter and a `lastmod` | `/llms.txt` answers; the sitemap's test | M |
| **T2.21** The builder's rail and chip | A click on the rail shows its panel open (plitzi-ui's `PopupSidePanel` reads `defaultValue` once — a change and release of plitzi-ui); the rail's buttons named on hover and for a screen reader; the class chip shows the author's name, the hash only when there is none; the dev-tools launcher clear of the panels. The builder's own type (under 12 px in places) is held to no scale yet: `screens.spec.ts` leaves it out (`brandScale: false`) | A click on each rail button shows its panel's content | M |
| **T2.22** Long reference pages | The CLI reference and the authoring errors by section (a page each, the search finding them), or one page that draws only the section in view; the docs' bar whole at 390; a lint suggestion when a page's text and its language disagree; the home's first paragraph taken from the docs' | Neither page over 6,000 px; the suggestion's test | M |
| **T2.28** The widths between | From 1024 the two-column layouts hold (the hero, `/pricing` with its summary beside the plans); the sticky summary clear of the rows; X-ray drawn once; the console's bar from 768; the run lines' column growing; the sweep of the key screens at seven widths | The sweep test; no control past the window's edge | M |

### WS3 — Code quality

| Task | Left | Done when | Size |
|---|---|---|---|
| **T3.2** `session` in parts | A load round within its band — the maintainer's to run while T5.2 has not landed | The round within its band | S |
| **T3.6** Builder modules with tests | One journey each in the workspace's e2e where a person uses Connectors, Actions, Fonts, Variables, Visitors, Elements and Transformers (their pure logic has unit tests since 2026-11-11) | Each journey failed once against a deliberate break | L |
| **T3.8** Exceptions, counted and explained | The rest of `exceptions.json`, each removed or given its why — the builder's `exhaustive-deps` (≈15) and the contexts' `createContext(undefined as unknown as …)` are the largest families | The table lower | M |

### WS4 — Authoring, MCP and CLI

| Task | Left | Done when | Size |
|---|---|---|---|
| **T4.1** A standing score | All of it: inventory `bench/`; twelve tasks over three project shapes, each with a scripted check; run on a schedule, one model per tier, alone and as a team; the element-level tasks both ways — the MCP's own operations and `addSpec` (with `replaces`) — so the score says which an agent gets right; success, calls, tokens, wall time and refusals kept by commit | A table per week in `bench/results`; a drop beyond its noise named by the report | L |
| **T4.6** What a refusal cost | From T4.1's records: the ten refusals and lints agents meet most, and whether the message alone was enough | A list with counts; no change made | S, after T4.1 |
| **T4.9** The run skills, on a diet | Every sentence of the six `runs*.md` skills: enforced by a refusal, said by a command, or only there — the first two leave the skill; what stays ordered by how often runs met it, one rule a line, a glossary opening `runs.md`; T4.1's team score before and after | `runs-lead.md` under 3,500 tokens; a test lists each rule taken out beside what carries it; the score no lower | L, after T4.1 |

### WS5 — Server work

| Task | Left | Done when | Size |
|---|---|---|---|
| **T5.2** The load round, kept | The probe and its cycle script from `tmp/load/` to `plitzi-sdk-server/test/load/`, with the estimate, the band and how to read `/_stats` refusals; the visual stack only; a nightly run keeping its result | `yarn load` documented in `docs/`; a round's result in a file by date | M |
| **T5.3** A contract for runners | `busy` and `too_large` in `describeFunctionRunner` (they need a service sized for it); step 2, the `ctx` channel behind an interface with two transports — today's socket and request/response (a signed address per run) — proven by a test runner with no socket. No cloud's runner here | The three runners and the test runner pass; no engine file names the socket | L |
| **T5.8** One trace for a run | The run's page linking its lines (the log reader already takes `q=trace=…`); a job's run starting a trace of its own; a runtime's calls carrying it | An e2e in the split topology reads one id on the request, the run, the runner's log and the answer | M |
| **T5.9** The engine's two closures | `runAction` and `createJobWorker` in parts with injected clocks, composed as today, no change of behaviour | Their suites unchanged; a load round within its band (T5.2) | L |
| **T5.11** Backups elsewhere, and a restore with a date (`plitzi-platform`) | **The maintainer names the bucket and the credential.** Then each dump copied off the node, encrypted with the cluster's age key, its retention said; a monthly Job restoring the latest into a scratch database and counting rows | A dump listed in the bucket; the restore Job green once, by hand first | M |
| **T5.13** Small drifts (`plitzi-platform`) | The vendored charts' images (Loki, Promtail) following their chart. The digests pinned 2026-11-11 are committed, not pushed | `make test` green | S |

### WS6 — Product

| Task | Left | Done when | Size |
|---|---|---|---|
| **T6.1** The funnel | The back-office's visual test of **Overview → Sign-ups** (its API and e2e shipped) | The section drawn for the seeded data, in the visual lane | S |
| **T6.2** Time to a first published page | Shipped 2026-11-12: the journey from Start free to the space answering on its address (`auth.spec.ts`, ~5 s, held to 6 s), and its mail wait taken out of the server (the account mails no longer awaited). Left: the budget lowered to what the stack measures once it runs that server | The journey's budget at its new figure | S |
| **T6.3** What a buyer checks | Shipped 2026-11-12: `/changelog` read from the releases, `/security`, both in the footer; the website's `security.txt` already served. Left: a status page's address in the footer once there is one | The link, when the page exists | S |
| **T6.4** A page's weight, shown to its owner | After WS1: per page in a space's analytics, the bytes by kind and the layout shift, measured by the page server and the collector. A design note first | The note, then the screen | L |
| **T6.5** The landing says who and proves it | The first screen names its reader with the docs' sentence; a quieter second call to action (a 90-second recording of the studio, an address kept); proof that exists today in place of the star count; pages per reader and the comparisons from one shared frame; the bands' art alternated | Each page in the sitemap and linked; both themes, every width of T2.28; the home within its budget | L |
| **T6.6** Found by a search | Structured data where the page is one — `FAQPage`, `Product`/`Offer` from `services/pricing`, `ItemList`, `BreadcrumbList`, `TechArticle` — written from the data the page draws; a share image per page made at publish (a template's cover exists: `GET /templates/:id/cover.svg`); docs' descriptions to length | A structured-data validator green on each page type; the sitemap's test (T2.18) | M |
| **T6.7** Docs for both readers | A reference part for the builder from its own names (`ui(…)`); "Copy as Markdown" and "edit this page"; "was this useful"; searches with no result listed; the REST routes and the MCP's tools as generated pages | The docs' tests green with the new part | L |
| **T6.8** A console that walks you in | A first run to the first publish as the page's main thing until done; renaming in place; acting on several spaces; one way to sort and page every table; a count of what needs attention on the bar; loading at its final size | T6.2's journey shorter; the tables in one shared component | L |

## 4. Design notes the open work needs

## 5. Found on the way, for the maintainer

Nothing open.

## 6. Not an agent's, tracked here

- **Waiting for the maintainer:** T5.11's bucket; T0.12's token permission (both at the end of this RFC); pushing
  `plitzi-platform`'s commits (a push there is a deploy); Chromium in the image for the screenshot service
  (~150–300 MB), so a space's journeys run there; the templates' covers on the dev cluster, looked at by whoever can
  reach it; T5.12's alerts sending — the chat's webhook into `alertmanager.sops.yaml` (`make secrets` with
  `ALERTS_CHAT_WEBHOOK_URL`; the mail needs nothing, it is the app's own, to its staff), `plitzi-platform` pushed and the
  app released with the chart's `metrics.podMonitor`/`metrics.alerts`, then each rule fired once on purpose and received
  at both (`cluster/docs/08-observability.md` § Alerts). Neither `promtool` nor `amtool` was on the machine that wrote
  them, nor was kube-prometheus-stack rendered with the new Alertmanager values: checked by `make test` and the chart's
  test, not by Prometheus's own tools.
- **W1, W26:** written as far as it goes without counsel (2026-11-11: the processor's terms, a consumer's withdrawal,
  agents, export, security and retention); then the final legal text from counsel, its placeholders filled (the company's name, address and
  registration, the governing law); the draft notice out; `TERMS_VERSION` moved.
- **X3:** how many plans are sold at all is a product decision; D6 settled only how `/pricing` opens.
- **X6 / D9:** `AI_ENABLED` by default.
- **From the deleted `agent-workflow-improvements.md`**, each worth its own task: a warning for a `when` rule or a
  `{{ step.path }}` naming a field the trigger does not pass (`unknown-trigger-field`); dev-tools lines for a skipped
  step, a session ended by a refusal, a binding to a source nobody publishes and a render error swallowed by
  `withElement`; twig's missing and empty token pinned by a test; forgot-password keeping `?redirect=` as sign-up does;
  a development loop that cannot run a stale `@plitzi/*` build.

## 7. Costs and risks

- **WS1 changes what every space loads.** A split that draws an element late is a regression customers see. The
  flicker and theme tests, `wasted` and the screens' budgets are the net; both splits keep a whole mode until three
  releases have gone by without a report.
- **A part per page moves a request to navigation.** Prefetch on view covers it; a space with hundreds of small pages
  may be better whole — hence the setting.
- **WS2's rows share the same few pages:** one visual lane, one after another, each with its render diff.

## 8. When this ships

This file is deleted. The targets of § 1 live on as the tables their tests read; the rules agents followed are already
`AGENTS.md`'s; whatever was decided in § 2 is a comment beside the code that enforces it.
