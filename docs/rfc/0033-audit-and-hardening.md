# RFC 0033 — Audit and hardening: what is left

Status, 2026-11-12: most of the audit has shipped. This file keeps **only the work still open** and what it needs to
be done. The audit's findings (W…, DS…, S…, Q…, A…, R…, PL…, X…, RS…), its method and every task already shipped are
in this file's history — `git show c29db583b:docs/rfc/0033-audit-and-hardening.md` — and in the commits that name
"RFC 0033". The procedure every task follows is unchanged:
[`0033-audit-and-hardening/00-how-to-work.md`](0033-audit-and-hardening/00-how-to-work.md).

## 1. Targets still open

Each is a test that ratchets: lowered when beaten, never raised.

| Target | Now | After | Task |
|---|---|---|---|
| JavaScript for a page of text (compressed) | ~330 KB (`screens.spec.ts` budgets) | No split (D13): any saving is made inside `plitzi-sdk.js` | — |
| Home height at 390 px | 16,847 px (ratchet 16,900; 15,991 before every control stood 44 px) | ≤ 16,000 px | T2.4′ |
| Controls under 44 px on a phone | 0 on every key screen but the home's 2 (the studio's billing toggle, 43 px after a capture scrolled the page; 44 at rest) | 0 | T2.4′ |
| Server CI | lint, types, unit; the e2e job written, never run on GitHub | + e2e, + visual `@smoke` | T0.6 |

## 2. Decisions the open work still reads

Answered by the maintainer on 2026-11-10.

| # | Question | Decided |
|---|---|---|
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

### WS2 — Website and sign-in (one visual lane)

| Task | Left | Done when | Size |
|---|---|---|---|
| **T2.4′** The home on a phone, looked at | The maintainer's look on a phone (the rails of § 02–07 and § 01's moment-then-picture, "looked at on a phone before it is called done"). The height back under 16,000 px without the 44 px targets giving way (they cost ~850 px: the footer's links, the studio's controls); the studio's billing toggle at 44 after a capture | § 1's two rows | S |
| **T2.17** Sign-in, said to everyone | **After the release that carries `autoComplete` tokens**: the auth seed names `username`, `new-password` and `one-time-code`; a focus ring on the fields, measured in both themes | The attributes asserted; the ring's contrast at 3:1 | S |
| **T2.18** `llms.txt` and the sitemap | **After the release that carries `blockAiCrawlers` by kind**: the website seed leaves it out, the docs' routing page says the list. An `llms.txt` for the website and the docs; the sitemap with each template and showcase chapter and a `lastmod` | `/llms.txt` answers; the sitemap's test | M |
| **T2.21** The builder's rail and chip | A click on the rail shows its panel open (plitzi-ui's `PopupSidePanel` reads `defaultValue` once — a change and release of plitzi-ui); the rail's buttons named on hover and for a screen reader; the class chip shows the author's name, the hash only when there is none; the dev-tools launcher clear of the panels. The builder's own type (under 12 px in places) is held to no scale yet: `screens.spec.ts` leaves it out (`brandScale: false`) | A click on each rail button shows its panel's content | M |

### WS3 — Code quality

| Task | Left | Done when | Size |
|---|---|---|---|
| **T3.2** `session` in parts | A load round within its band — the maintainer's to run while T5.2 has not landed | The round within its band | S |
| **T3.6** Builder modules with tests | One journey each in the workspace's e2e where a person uses Connectors, Actions, Fonts, Variables, Visitors, Elements and Transformers (their pure logic has unit tests since 2026-11-11) | Each journey failed once against a deliberate break | L |
| **T3.8′** `plitzi-sdk-server`'s exceptions, explained | The workspace's are done (each removed or with its why, the table lower). In `plitzi-sdk-server` ~25 have no why yet — the Prisma and Redis base models' `any` and casts, two file-wide `no-non-null-assertion` in the CSS parser, `pubSub`'s `any`, the seeder's JSON casts: each removed or said why, `scripts/exceptions.json` lower | `yarn check:exceptions` there; none without a why | S |

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
| **T6.1** The funnel | The back-office's visual test of **Overview → Sign-ups** (its API and e2e exist) | The section drawn for the seeded data, in the visual lane | S |
| **T6.3** What a buyer checks | A status page's address in the footer, once there is one | The link, when the page exists | S |
| **T6.4** A page's weight, shown to its owner | Per page in a space's analytics, the bytes by kind and the layout shift, measured by the page server and the collector. A design note first | The note, then the screen | L |
| **T6.5** The landing says who and proves it | The first screen names its reader with the docs' sentence; a quieter second call to action (a 90-second recording of the studio, an address kept); proof that exists today in place of the star count; pages per reader and the comparisons from one shared frame; the bands' art alternated | Each page in the sitemap and linked; both themes, every width of the sweep; the home within its budget | L |
| **T6.6** Found by a search | A share image per page made at publish (a template's cover, a doc's title on the brand's ground) — a platform change, its evidence to the maintainer first | A share image on each page type that has none; the sitemap's test (T2.18) | S |
| **T6.7** Docs for both readers | The REST routes as a generated page — waits on § 5: the API declares no route table with what each route does | The docs' tests green with the new part | M |

## 4. Design notes the open work needs

## 5. Found on the way, for the maintainer

Platform changes a seed met, with the evidence — each waits for the maintainer's word:

- **A page's Markdown at its own address.** The CDN takes media, JSON and modules, no text
  (`uploadResource.ts`, `ACCEPTED`), so the docs keep each page's Markdown as JSON (`{ title, markdown }`) for "Copy as
  Markdown", and an agent has no `.md` to be pointed at. Either the CDN takes `text/plain`/`text/markdown` (a general
  change: `llms.txt`, `ads.txt` and a page's Markdown are text), or the page server answers `<path>.md` — which is
  T2.18's `llms.txt` route's neighbour.
- **The REST routes as a reference.** The API's routes are Express routers with no table of what each does — a list
  walked off them (as `routeGuards.test.ts` does) has methods, paths and guards, not one word for a reader, and it
  would teach the builder's and the CLI's internal routes as a public surface. Either the API declares its routes
  (path, method, guard, a sentence, the body) and the page is written from that, or the REST reference is dropped from
  T6.7 and the CLI and the MCP stay the documented ways in.
- **A page that joins a channel late misses what was said meanwhile** (Pizarra, a seed's own): a writer who reloads
  while somebody reveals private writing keeps the bar — the reveal is said between the board's load and the page's
  join to `board:<id>`. `retain` would replay the last of each type, but that channel carries thirteen (the elements
  among them); a topic of the board's state alone, retained, or a re-read once joined, closes it. The visual test waits
  for the page's channels before revealing.
- **Structured data off the browser's space.** Every page's `seoStructuredData` travels in the shell every page loads
  (65 docs pages: 2.5 KB gzipped of the 54 KB the front page's space weighs), and only the server's head reads it
  (`resolvePageSeo.ts`) — the browser's `PageHead` writes it again on a client navigation, which no crawler sees. Sent
  with the page's own part, or not at all, a space with rich data pays nothing for it on the pages that do not show
  it.
- **A page's words and its language.** Ceniza said `lang="en"` over Spanish, and nothing in authoring could say so: a
  suggestion when a page's text and its `settings.language` clearly disagree (its words read against the language's
  commonest — a cheap test, no model) would catch it in every space. A platform change: the threshold and what a
  mixed page (a code sample, a brand name) is held to are the maintainer's.
- **A 1024 screen is a tablet.** The platform's tablet rules apply up to and including 1024 px
  (`sdk-shared/style/breakpoints.ts`), so every layout meant below a desktop is what a 1024 screen gets. The hero holds
  two columns there by itself (a grid of two 400 px columns when they fit), but `/pricing` changes its whole shape on a
  tablet — the summary a bar at the foot instead of beside the plans — which no width inside one range can say. Either
  the desktop starts at 1024 (tablet to 1023: every space's 1024 layout changes) or `/pricing` keeps its tablet shape
  at 1024.

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

- **WS2's rows share the same few pages:** one visual lane, one after another, each with its render diff.

## 8. When this ships

This file is deleted. The targets of § 1 live on as the tables their tests read; the rules agents followed are already
`AGENTS.md`'s; whatever was decided in § 2 is a comment beside the code that enforces it.
