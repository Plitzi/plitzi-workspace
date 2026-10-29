# RFC 0029 — Plans and entitlements: charge for the cloud, not for the code

- **Status:** Accepted — phases 1–3 built (2026-10-29), phase 4 but for the client editor seat (§12)
- **Author:** Carlos Rodriguez
- **Date:** 2026-10-29
- **Scope:** `plitzi-sdk-server` (plans, subscriptions, metering, every gate, the website's pricing and console),
  `apps/builder` (what it offers, locks and says), `apps/mcp`, `apps/cli` (how a cloud command answers a plan it
  lacks), `@plitzi/sdk-shared` (the entitlements contract), the billing gateways

---

## 1. Summary

Plitzi is open: `@plitzi/sdk-server`, the CLI, the SDK and authoring are the whole product, and anyone may run them.
What Plitzi sells is **its cloud**: the people who build there together, and the sites it serves. Today the plans do
not say that. They price a workspace by page views, let the free tier publish on a custom domain without the badge,
keep every snapshot of every environment forever, and offer no way to pay at all — there is no checkout, no customer
portal, and the "Upgrade" and "Compare plans" links lead to a page that does not exist.

This RFC replaces that with two subscriptions and one rule:

- **A workspace plan** sells what people use to build in the cloud: seats, teams, roles, history, the hosted MCP and
  multi-agent runs.
- **A site plan** sells what Plitzi's cloud spends on one space: a custom domain, no badge, environments and their
  caches, snapshots, production traffic, server code — and the CLI's conveniences that reach the cloud.
- **The rule:** what happens on the user's machine, or teaches them, is free; what the cloud keeps, serves or computes
  on their behalf is paid. Self-hosted spaces never pay Plitzi anything.

Plitzi never stands between an agency and its client: it bills only its own customers (§9).

## 2. Where we are

What the code does today (`plitzi-sdk-server`):

| | Today |
|---|---|
| Who holds a plan | The **workspace** (`Subscription.workspaceId`); `Subscription.spaceId` is reserved, unused |
| Plans | Free (implicit, `settings.analytics.freePlan`), Pro, Max, Lifetime (`prisma/seeds/data/billing.ts`) |
| What is metered | Page views, pooled per workspace and per space (`PlanMeter` weights per area: RSC refresh, MCP, cached) |
| Free over quota | Throttled, badge and banner forced (`analytics/enforcement.ts`); never blocked |
| Paid over quota | Overage accrued per 1,000 (`UsageRecord`) |
| Gated by plan | Running functions and exporting a space (`checkPaidPlan`), runtimes (`checkPlanFeature('spaceRuntimes')`), members and teams (`workspaces/limits.ts`), the element cap at publish |
| **Not gated** | Custom domains (`api/deployments`), the badge under quota, snapshots, staging/production, uploads to the CDN, every CLI command that reaches the cloud |
| Snapshots | One Mongo copy of schema, style, actions, connectors, functions, runtime and sources per revision per environment (`versions/writeSnapshot.ts`), **kept forever** |
| `*.plitzi.app` | Serves the draft (revision 0); free traffic is 10,000 views a month, monthly window, 20 requests/minute |
| Paying | Webhooks only (`/billing/webhooks/:provider`, Stripe and Paddle adapters). **No checkout, no portal.** `/pricing` is a 404 |
| Lifetime | Unlimited in every direction, granted by hand (`billing/lifetime.ts`) |

Two things in that table cost money every month: a free account can host a production site on its own domain for
free, and every snapshot ever taken is stored for ever.

## 3. Principles

1. **Charge where value and cost meet.** A site going live on a domain is when the customer gets value and when the
   cloud starts spending. Building stays free.
2. **The open source is whole.** No paid feature lives inside `sdk-server`, the CLI or the SDK as a crippled path;
   every gate is Plitzi's cloud policy, in `plitzi-sdk-server`. A self-hoster gets the full cycle, as today.
3. **One source of truth for entitlements.** Every gate — the builder, the API, the MCP, the CLI's server side, the
   page server — asks one function what a workspace or a space may do (§7.1). No gate reads a plan row directly.
4. **Nothing silent.** A refusal names the plan that includes it and links to it; the builder shows the same words.
5. **A downgrade never deletes.** It stops what costs money (a domain served, an environment, a job) and keeps the
   work; the existing rule for members (refuse the next invite, remove nobody) extends to everything.
6. **Plitzi bills only its own customers.** No billing on behalf of others, no cash payouts (§9).

## 4. The catalog

### 4.1 Workspace plans — people and building

| | Free | Team | Business | Enterprise |
|---|---|---|---|---|
| Price (hypothesis) | 0 | 19 €/month | 79 €/month | contract |
| Seats | 1 | 3 included, + 7 € a seat | 10 included, + 9 € a seat | contract |
| Teams | — | 3 | unlimited | unlimited |
| Custom roles | — | — | yes | yes |
| SSO, audit log | — | — | yes | yes, + SLA |
| Change history kept | 7 days | 180 days | 1 year | contract |
| Hosted MCP | 300 tool calls a day | unlimited | unlimited | unlimited |
| Multi-agent runs in the cloud | — | yes, once hosted runs exist | yes | yes |
| Analytics kept | 7 days | 90 days | 1 year | contract |

A seat is a member or a pending invitation. Seats beyond those included are bought in the console (`quantity` of the
plan's seat price on the gateway, prorated); an invitation past the seats bought is refused with the way to add one,
and removing seats never removes a member — it refuses the next invitation. A space's analytics are kept for the
longer of its workspace plan's window and its site plan's (§4.2).

### 4.2 Site plans — what the cloud spends on one space

| | Free (`*.plitzi.app`) | Site | App | App+ |
|---|---|---|---|---|
| Served on | `<space>.plitzi.app`, draft only | + custom domains | + custom domains | + custom domains |
| Badge | always | none | none | none |
| Traffic | low, daily ceiling (§5) | production allowance | higher | highest |
| Overage | throttled | per block | per block | per block |
| Environments | draft only | production | staging + production | staging + production |
| Snapshots kept | — | 10 | 50 | 200 |
| CLI cloud conveniences (§8) | — | yes | yes | yes |
| Own plugins and fonts on the CDN | — | yes | yes | yes |
| Connectors (a downgrade keeps those it has) | — | yes | yes | yes |
| Functions, jobs, schedules, `kv`, `db.query`, `email.send` | — | — | yes | yes, larger jobs |
| Visitors with roles (Sign in with Plitzi) | — | — | yes | yes |
| Realtime channels | — | — | yes | yes |
| Feature flags per environment | — | — | yes | yes |
| A runtime of the space's own | — | — | — | yes |
| Analytics kept | 7 days | 90 days | 1 year | 1 year |

Price hypotheses, to be validated against the cost of serving a site (§10): **Site 12–15 €/month, App 39–49 €/month,
App+ 99–149 €/month**, seeded at 12, 39 and 99; yearly billing with two months free, offered by default (a
yearly price is a plan row of its own, `interval: year`, at ten months).

### 4.3 Partner (agencies) — phase 4

Wholesale pricing on site plans by volume, a **client editor** seat (content without the design), usage reports per client site to bill from, and a
**handover** that makes the client a direct Plitzi customer with the agency rewarded in account credit. See §9.

**Plitzi itself is never white-label** (Carlos, 2026-10-29): it is one strong brand, as Webflow is — an agency's
clients sign in to Plitzi and edit in Plitzi, never under the agency's name or domain. What is built with Plitzi is
another matter: a site or a product made from a template carries its maker's brand alone (no badge on a paid plan),
so white-label products are made with Plitzi — templates are how.

### 4.4 Self-hosted and Lifetime

- **Self-hosted** pays nothing and is gated by nothing. Enterprise self-hosted is a support or licence contract for
  add-ons beside the open source (managed SSO, audit, SLA) — never a cut of it.
- **Lifetime** becomes a workspace plan (seats for life) with a fixed number of site plans of a fixed tier. Unlimited
  hosting for life is a cost with no revenue and is not sold again; Plitzi's own accounts keep an internal plan.

## 5. `*.plitzi.app` on the free plan

The free address exists to build, preview and share, not to host production traffic.

- **Allowance:** 100 page views a **day** per workspace (`quotaWindow: daily`, `FREE_PLAN_PAGE_VIEWS_QUOTA`), so one
  afternoon cannot spend a month, and the existing 20 requests/minute. One window, not a monthly total beside a daily
  ceiling: a plan has one window, and the daily one is the ceiling that matters on a shared address.
- **Over it:** throttled with the badge and the "over its plan" notice, as today. Never a hard error.
- **Not counted:** the builder's preview, thumbnails and screenshots (they never reach the metered path today; kept so).
- **Abuse:** free subdomains are where phishing is hosted. A free site is served `noindex`, publishing it needs a
  verified email, and every free page links a report address.
- **A space with a site plan** keeps its `*.plitzi.app` address under its plan's allowance.

## 6. Snapshots and environments

### 6.1 Snapshots

A snapshot freezes everything a revision needs, in Mongo, per environment. They are a **site plan** feature with a
retention count (§4.2):

- **Kept:** every revision published on a domain, whatever its age (pruning one would break a live site); the latest
  N of the rest.
- **Pruned:** the oldest unpublished revisions beyond N, by a job, after the builder and the API have said so: the
  snapshot dialog shows what the next one will remove before it is taken.
- **When:** after each snapshot is taken (`versions/pruneSnapshots.ts`), against the plan the space is on then. A
  downgraded space that takes no new snapshot keeps the ones it has — nothing grows — and the next one prunes to the
  new count. A job pruning without a snapshot is not needed for cost and is not built.
- **Free:** no snapshots. The draft is what `*.plitzi.app` serves.

### 6.2 Environments

`development`, `staging` and `production` each hold their documents, their flags and their caches. **Production** comes
with a site plan; **staging** and **development** with App and above. A domain can be attached only to an environment the space's plan includes;
`main` (the draft) is the free plan's only environment.

## 7. How it is enforced

### 7.1 One entitlement resolver

`plitzi-sdk-server` gets `services/billing/entitlements.ts`, the only reader of plans for a gate:

```ts
entitlementsOfWorkspace(workspaceId): WorkspaceEntitlements // seats, teams, roles, history, MCP, cloud runs
entitlementsOfSpace(spaceId): SpaceEntitlements             // tier, domains, badge, environments, snapshots,
                                                            // traffic, server code, visitors, realtime, CDN, CLI
refusalFor(entitlements, capability): PlanRefusal | undefined // the words and the plan that includes it
```

`checkPaidPlan` and `checkPlanFeature` become calls to it. A capability is a closed union, so a gate that names one
that does not exist is a type error, and the console's plan table is generated from the same catalogue, so what the
page promises and what the server enforces cannot drift.

### 7.2 The refusal every surface shows

```json
{ "error": "A custom domain is included in the Site plan and above.",
  "code": "plan-required", "capability": "customDomain", "requires": "site",
  "upgradeUrl": "https://app.plitzi.com/billing?space=…&plan=site" }
```

HTTP 402. The builder shows it in place, the MCP returns it as the tool's refusal, and the CLI prints the error and the
link (§8). A self-hosted server never sends one.

### 7.3 Where each gate sits

| Capability | Gate |
|---|---|
| Custom domain | `api/deployments` (create, and serving: a domain of a space with no site plan is served the `*.plitzi.app` notice) |
| Badge | page server: on unless the space's plan removes it (today only over quota) |
| Snapshot | `SpacePublishMutation` / `versions/writeSnapshot.ts`, and the pruning job |
| Environment | publishing to it, and attaching a domain to it |
| CLI cloud commands | the API routes they call (§8), not the CLI |
| CDN uploads | `api/cdns`, `api/spaces/:id/fonts`, plugin upload |
| Server code, visitors, realtime, flags per environment | their existing entry points (`functions/lookup`, `auth/visitors`, the realtime grant, flags publish) |
| Free traffic | `analytics/enforcement.ts` with the free plan's daily window |

### 7.4 Every surface reads the same entitlements

A gate on the server is what makes a plan true; the surfaces make it **visible before** someone runs into it. Each one
reads the entitlements (§7.1) rather than guessing from a plan's name, and shows a locked capability as locked — with
the plan that includes it and the way there — instead of offering it and failing on save.

- **The contract.** `TSpaceEntitlements` / `TWorkspaceEntitlements` in `@plitzi/sdk-shared/network`, beside the
  `TSpaceQuota` the builder already reads, answered by a GraphQL query (`spaceEntitlements`, `workspaceEntitlements`)
  and the REST API (`GET /spaces/:id/entitlements`, `GET /workspaces/:id/entitlements`). Each capability says whether
  it is included and, when not, the refusal of §7.2. **A server that answers no entitlements means everything is
  included** — a self-hosted deployment, a development server — so the builder and the CLI carry no plan logic of
  their own, only the reading of the contract.
- **The builder** (`apps/builder`): the publish dialog (environments it may publish to, snapshots and what the next
  one prunes), domains, plugin and font uploads, functions and jobs, visitors and roles, realtime, flags per
  environment, the runtime — each locked with the plan that includes it; the header's quota meter beside the plan's
  name, and an "Upgrade" that opens the checkout for this space.
- **The website** (`platform/website`, the console): the space record's domains, environments and snapshots; the
  workspace settings' members, teams and roles; a billing page per workspace (its plan, its sites' plans, invoices,
  the portal); `/pricing` generated from the catalogue; the "Upgrade" and "Compare plans" links that today lead to a
  404.
- **The MCP** (`apps/mcp`): a tool whose capability is not included answers the §7.2 refusal; the primer says what
  the space's plan includes, so an agent does not plan work it cannot ship.
- **The CLI** (`apps/cli`): prints any refusal with its link (§8); `plitzi doctor` against a cloud space says what its
  plan does not include when the project uses it (functions in `src/functions` on a Site plan).

## 8. The CLI's cloud conveniences

Commands that reach Plitzi's cloud are a site-plan convenience: `plitzi create --from` and `space pull` (`/export`),
`space push` (`/import`, and `/cdns/:id/assets` for its files), `plugin upload` (`/cdns/:id/plugins`), `source keep`
(`/sources`). Two are left open on purpose: `space watch` / `space activity` read `/activity`, which the free plan's
MCP reads too and which costs a read; and saving functions, which every plan may do — running them is App's. Everything local
stays free: authoring, `lint`, `verify`, `doctor`, `page check/shot/play` against a local server, and multi-agent runs
on the user's machine. Signing in (`account login`) is free — it is how the refusal reaches a person.

The gate is on the **server** (`requireCapability`, after `requireSpaceMember()`); a CLI-side check alone would be a
suggestion. The CLI needs no knowledge of Plitzi's plans: a refusal's `error` ends with its link ("… Upgrade:
<url>"), and every cloud command prints the server's `error` — a self-hosted server simply never sends one.

A free user can still take their work: the builder offers the space's documents as a JSON download. Turning them into
a project (`--from`) is the convenience.

## 9. Agencies without intermediation

Plitzi bills only its own customers. It does not charge an end client on an agency's behalf, does not pay agencies in
cash, and does not hold money for anyone — that would make it the intermediary, with the fiscal and financial duties
that come with it. What replaces each:

- **The agency bills its client** with its own tools; Plitzi gives it per-site usage and cost reports to bill from.
- **Wholesale pricing** is the agency's margin, set by the agency.
- **Handover** makes the client a direct Plitzi customer; the agency's reward is account credit.
- **Rewards and referrals** are credit, never payouts.

The marketplace (selling products) is a separate question and out of scope here.

## 10. Payments and operations

- **Gateway:** Paddle live (merchant of record: VAT and sales tax registered and remitted for Plitzi), Stripe for
  testing — as `docs/billing/README.md` already recommends. Prices on `/pricing` are gross under Paddle.
- **Checkout and portal:** new. Subscribing to a workspace plan or a site plan, changing tier with proration, invoices,
  payment method and cancellation, through the gateway's hosted checkout and portal. A site plan's checkout carries the
  space (`custom_data`), which is what `Subscription.spaceId` was reserved for.
- **`/pricing`:** a real page on the website, generated from the catalogue (§7.1), with the traffic calculator the
  landing already has.
- **Failed payments:** retries, seven days of grace, then degrade (badge, `*.plitzi.app`) — never switched off.
- **Grandfathering:** a plan row is versioned (`active: false` closes it to new customers); a price change applies to
  new subscriptions, and existing ones move on renewal with notice.
- **Cost per site:** metering already splits origin from cache and weights each area. Add what a site costs to serve
  (SSR CPU, function CPU, storage of snapshots and CDN) per month, so prices are set on data and loss-making sites are
  seen.

## 11. Metrics

MRR; ARPA per workspace; paid sites per workspace; conversion from free to the first site plan; net revenue retention;
churn by reason; gross margin per site.

## 12. Phases

**Phase 1 — close the leaks and make paying possible** (done 2026-10-29)
- Done: the resolver and catalogue (`plitzi-sdk-server/src/services/entitlements/`) and the 402 `plan-required`
  refusal; functions, runtime and `--from` moved onto it; custom domains and environments (REST and the static deploy
  mutation); snapshots and their pruning on publish; CDN uploads (fonts, plugins, assets) and the CLI's cloud routes;
  the badge (`render.badge`, SSR and client) and `noindex` on the free plan; the free plan's daily allowance, no
  element cap and 7 days of history; the contract (`@plitzi/sdk-shared/network`, `GET /spaces/:id/entitlements`);
  the builder's locks (Snapshot, Publish, the snapshot form's environments, mirroring a font); the transition (a paid
  workspace's spaces are App, Lifetime's App+, until spaces hold subscriptions).
- Done on the website: the space record's domain form reads the entitlements and shows the plan that includes a
  domain where it is not; the landing's plans say what each one does now (the free plan on plitzi.app, a hundred
  views a day; domains, environments and snapshots on the paid ones); `/pricing`, written from the catalogue, with a
  contact until phase 2's checkout; `/report-abuse`, which every badge links. The docs' cloud guide says what is paid.
- Done last: a free site is served once somebody in its workspace has confirmed their email — until then a visitor
  reads "This page is not available." (`SSRMeterDecision.unavailable`, a 503 nobody caches or indexes, the view not
  counted); the MCP's primer names the space's plan and, by the plan that includes them, what it does not
  (`getEntitlements`).

**Phase 2 — site subscriptions and paying** (done 2026-10-29, prices awaiting Carlos)
- Done: a plan has a `scope` (`workspace` | `site`) and a site plan its `siteTier`; the seeded catalogue is Site,
  App and App+ (site) and Team and Business (workspace), each with the price it shows; Pro and Max are closed to new
  checkouts and keep hosting their workspaces' spaces (`features.legacyHosting`) — a Team or Business plan sells
  people, not hosting. A site subscription is one space's (`Subscription.spaceId`, only on a site plan); the space's
  tier is the higher of its own subscription and what its workspace's plan hosts.
- Metering: a subscribed space spends its own allowance, under a period of its own (`bp<start>:space<id>`), and the
  close of that period reads the same key; the free pool never throttles it.
- Paying: the gateway's hosted checkout and portal (Stripe Checkout and Billing Portal; Paddle transactions and
  customer portal sessions), `POST /workspaces/:id/billing/checkout|portal` and `POST /spaces/:id/billing/checkout`,
  only for the workspace's owner; a space that already holds a site plan is sent to the portal (409).
- Dunning: the gateway's own (retries and emails); a `past_due` subscription keeps serving for seven days
  (`PAYMENT_GRACE_SECONDS`), then the space falls to what its workspace hosts.
- Website: the workspace's settings buy Team / Business and open the portal; the space record names the space's plan
  and buys Site / App / App+; `/pricing` shows the prices and sends to the console.
- Seats: a workspace plan includes some (`maxMembers`) and sells more at its seat price (`seatProviderPriceId`, the
  subscription's `extraSeats`, read from the gateway's item quantity); bought at checkout or set later
  (`POST /workspaces/:id/billing/seats`, prorated), a refusal of an invitation names the way to a seat.
- The workspace's entitlements: `TWorkspaceEntitlements`, `GET /workspaces/:id/entitlements` — seats taken, ceilings,
  teams / custom roles / SSO / audit log with the plan that includes each (`entitlements/workspaceCatalog.ts`, which
  `checkFeature` refuses with too).
- Analytics kept per plan (`analyticsRetentionDays`): a space reads the longer of its two plans' windows; every reader
  (`/spaces/:id/analytics`, the stats, the workspace's analytics) cuts there and says so (`analytics/retention.ts`).
- The hosted MCP's daily ceiling (`mcpCallsPerDay`, 300 on Free): sdk-mcp's `admitToolCalls` adapter, counted per
  workspace per UTC day; a refused call reads the refusal as its result.
- Gates: connectors (a new one), visitors (granting a role, and serving one), flags per environment (publishing flags
  alone), realtime (sdk-server's `realtime.admitSpace`, a 402 that names the plan).
- Yearly prices: each open plan has a row by the year at ten months, holding twelve months of page views.
- Website: the workspace's seats and yearly checkouts, the space's yearly checkouts, `/pricing` with yearly prices,
  seats, analytics and the MCP's ceiling; the workspace's usage reads a subscribed space in its own period and names
  its plan. Builder: the plan and Upgrade in the header, a notice at the top of functions, visitors, channels, flags,
  runtime and connectors, and the snapshot dialog saying what the next snapshot removes
  (`GET /spaces/:id/snapshots/next-prune`). `plitzi doctor`'s `plan` area: what the project uses that its space's
  plan leaves out.
- Carlos's: the gateway's real prices and the confirmed figures.
- Business, built after (2026-10-29): **custom roles** — a workspace's own roles out of a space's permissions
  (`role.workspace_id`, `services/auth/spaceRoles.ts`, `/workspaces/:id/roles`, the website's Roles page), given like
  the platform's to a team, a person or as the member role; **the audit log** — what is done in a workspace kept on
  every plan (`workspace_audit_event`, `services/audit/`), read on Business (`/workspaces/:id/audit`, JSON or CSV, the
  website's Audit log); **single sign-on** — any OpenID Connect issuer, for the email domain a workspace proves by DNS
  (`createOidcProvider` and run-time providers in sdk-server; `workspace_sso`, `services/sso/`, `/workspaces/:id/sso`,
  the website's Single sign-on page and the auth space's): its people who are not members join on a free seat, and,
  required, the domain's password sign-in is refused (`sso-required`).
- A downgraded site's custom domain (§13): served with the notice for `DOWNGRADED_DOMAIN_GRACE_DAYS` (14) from the
  first request after the lapse, then "This page is not available." there; `*.plitzi.app` keeps the draft.
- The JSON download is free on every plan (§3, the code is the customer's): the builder's export offers JSON on Free.

**Phase 3 — margin** (done 2026-10-29)
- Lifetime reshaped (§4.4): Plitzi's own accounts hold the internal plan (`billing/internal.ts`, `yarn internal`), and
  a lifetime deal is a workspace plan for life — Team's seats, teams and history — with a fixed number of sites of a
  fixed tier (`billing/lifetime.ts`, `yarn lifetime <account> --sites <n> --tier <tier>`): each a site subscription
  with a monthly window that its owner puts on a space from the space's record (`/spaces/:id/billing/lifetime-site`).
- Plan versioning (§10): a price change is a new row; `yarn plans:move <from> <to>` closes the old one, names its
  successor (`supersededById`) and moves each subscription's price from its next renewal (the gateways'
  `changePrice`, unprorated), mailing the workspace's owner first (`plan-change`).
- Cost per site: each space's origin and cached views, its functions' CPU (now kept per space and day) and its
  snapshots' bytes, at the unit costs configured (`COST_*`), beside the revenue of what hosts it —
  `GET /admin/billing/costs`, the ones losing most first. The CDN's bytes are the bucket's and are not measured.
- Metrics (§11): `GET /admin/billing/metrics` — MRR with seats, ARPA, paid sites per workspace, conversion of the last
  90 days' workspaces, churn of the last 30 days by reason (a cancellation now keeps when and why), net revenue
  retention and gross margin per site.
- Carlos's: the unit costs, read from the infrastructure's bill.

**Phase 4 — partners** (built 2026-10-29 but for the client editor seat)
- The partner plan (Partner, a workspace plan beside Business, `features.partner`): wholesale prices on the site plans
  it buys, by the paid sites it holds counting the one bought (`PARTNER_DISCOUNTS`, 15 % from the first, 25 % from
  ten, 35 % from fifty — hypotheses), each tier a gateway coupon applied at checkout; a tier with no coupon refuses the
  checkout rather than charge the full price.
- Per-client reports: `GET /workspaces/:id/reports/sites?days=30&format=csv` — each site, what it served and what its
  plan costs the agency, to bill each client from.
- Handover with credit: `POST /spaces/:id/handover` mails the client a link (`space-handover`, two weeks); the client
  accepts it (`/handover/:token` on the website, `POST /handovers/:token/accept`) into their own workspace or one they
  administer; the space moves (`spaces/move.ts`, shared with `/spaces/:id/move`), a lifetime site on it is freed, the
  agency's site plan for it ends at its renewal and the agency is credited `PARTNER_HANDOVER_CREDIT_MONTHS` of it —
  on Stripe as customer balance; on Paddle, which keeps none, the answer says the amount to credit by hand.
- Not built, and why: **the client editor seat** needs a builder mode that edits content without design, which the
  permissions do not separate today (`spaceUpdate` is both) — a decision of Carlos's before it is built. Plitzi itself
  is not white-label (§4.3).

## 13. Open questions

- The exact allowances and prices — after the cost per site is measured (phase 3), with phase 1's hypotheses until then.
- The client editor seat (§4.3, phase 4): Carlos's decision before it is built.

Decided: multi-agent runs on the user's machine stay free (§3: they cost Plitzi nothing); the JSON download is the raw
documents, on every plan; a downgraded site's custom domain shows the notice for 14 days; Plitzi itself is not white-label
(what is built with it, from templates, may be).
