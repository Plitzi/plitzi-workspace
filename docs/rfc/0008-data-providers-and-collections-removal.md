# RFC 0008 — Data providers, RSC connectors, and Collections removal

- **Status:** Implemented (2026-08-03) — see §6 for what each phase delivered
- **Author:** Carlos Rodriguez
- **Date:** 2026-08-02
- **Scope:** `@plitzi/sdk-shared`, `@plitzi/sdk-elements`, `@plitzi/sdk-interactions`, `@plitzi/sdk-collections` (removed), `apps/builder`, `apps/sdk`, `apps/server`, and `plitzi-sdk-server`

---

## 1. Summary

Stop storing customer content. Turn `Collection` from a **Plitzi-owned database** into a
**normalized data contract** produced by external providers, resolved server-side through
RSC, and configured by **declarative connector manifests** rather than per-CMS code.

Three moves, in this order:

1. **Delete the Collections backend** (Mongo models, GraphQL CRUD, builder content manager).
   Keep the contract (`Collection` / `CollectionRecord` / `PageInfo`) and the components that
   consume it.
2. **Make RSC the data-resolution engine** so API credentials never reach the browser and
   server-rendered pages ship with data.
3. **Generalize credentials** to a key/value bag so a new CMS is configuration, never a
   migration and never new code.

The result is one data path instead of two, no content-storage liability, and a snapshot
that stays a pure static document.

---

## 2. Motivation

### 2.1 Engineering

Today there are **two parallel data paths** that do conceptually the same thing — register a
source in `runtime.sources` and mount a `StoreProvider`:

| Path | Element | Transport | Credentials | SSR |
|---|---|---|---|---|
| Collections | `CollectionContainer` | GraphQL → Mongo | n/a (owned data) | prefetched into the snapshot |
| External API | `ApiContainer` | `fetch` in `useEffect` | **bearer token in the browser** | none — client-only |

A third (RSC) is already scaffolded and empty. Consolidating to one removes the duplication
instead of adding to it.

The storage half is the expensive half, and it is undifferentiated: schema migrations, query
language, pagination semantics, permissions, backups, quota and abuse handling. Owning
customer content also means inheriting **GDPR/DSR obligations, data residency, and being the
outage**. None of that is reduced by refactoring; it is only removed by not storing.

### 2.2 Commercial

Market conditions (2026) that this design answers directly:

- **72% of content teams already run a headless CMS; 61% run more than one.** Owning the data
  subtracts. Connecting to what they already have is the sellable position.
- **"We never hold your content"** removes Plitzi from the data-processor role. This shortens
  enterprise legal review — a concrete sales advantage for an embeddable B2B product.
- **Credentials never reach the browser** — passes security review by construction, not by
  policy.
- Typed `fields` are preserved, so the builder keeps typed bindings, visual query building and
  validation. That is the UX gap between this and "paste a URL and hope".

---

## 3. Starting point (measured)

- ~**4,000 LOC** in files named `*collection*`; **134 files** reference collections across
  `plitzi-workspace` and `plitzi-sdk-server`.
- `apps/builder/src/modules/Collection/` — **1,398 LOC across 15 files** (the content manager:
  collection CRUD, field builder, record forms).
- **10 GraphQL resolvers** in `plitzi-sdk-server` (4 queries, 6 mutations) plus ~20 client
  documents duplicated across the `sdk` and `builder` networks.
- **2 Mongo models** (`Collection`, `CollectionRecord`).
- `getOfflineData` embeds every collection into the deploy snapshot.
- The MCP validator carries a **special case** for collection callbacks: it is the only
  callback `source` whose parameter set is OPEN (`builtinCallbacks.ts`), because records carry
  arbitrary per-collection field values.

What is already provider-agnostic and must be kept:

- `CollectionContainer` reads `collection` from a hook, derives `sourceFields` from
  `collection.fields`, publishes `runtime.sources[...]`, mounts a `StoreProvider`. **Nothing in
  it knows about Mongo.** Only `useCollectionContext` binds it to GraphQL.
- The RSC pipe: `/_rsc` endpoint with TTL cache and partial refresh by `?ids=`, the initial
  payload already injected server-side (`buildServerInfo.ts`), `RscProvider` + `useRscData` on
  the client, and `Element.runtime: 'server' | 'client' | 'shared'` in the schema types.
  **The producer is empty** — `getRscData` returns `{ serverData: {} }` — and no element
  consumes `useRscData` yet.
- `matchRoutePath` / `getRouteParams` in `sdk-navigation` are React-agnostic and therefore
  reusable server-side.
- `createJsonAdapters` serves `getOfflineData` from JSON files with no database, so demos and
  templates do not depend on the Collections store.

---

## 4. Design

### 4.1 `Collection` becomes a contract, not a store

`Collection`, `CollectionField`, `CollectionRecord` and `PageInfo` stay in `sdk-shared` as the
**normalized shape every provider produces**. The typed `fields` map is what gives the builder
typed bindings; that is the asset worth keeping.

Changes to the contract:

- `CollectionRecord.values` widens from `Record<string, string | number | boolean>` to allow
  nested JSON. External CMSs have components, relations and localized objects; a flat map
  cannot hold them. This is required, not optional.
- `BuilderCollectionContextValue` loses `addCollection` / `updateCollection` /
  `removeCollection`. Schema authoring belongs to the source CMS.
- `privacy` is dropped; access is whatever the provider enforces.

Non-goal: renaming `Collection` to `DataSet`. The semantics shift but the name still reads
correctly, and a rename would touch 134 files for no functional gain.

### 4.2 Connector manifests — configuration, not code

There is **no server-side extension point today**: `PluginManager` compiles and serves *client*
assets under `/sdk-plugins`; it does not execute third-party server code. So "support any CMS"
has exactly two shapes: N connectors inside the core (N × maintenance, growing with every
customer), or **one engine driven by a declarative manifest**. This RFC takes the second.

**The manifest is server-side state.** It does *not* live in the space schema. The schema is
hydrated into the browser, so anything placed there is public — see §4.3.1 for the leak that
already exists because of this.

The split:

| Where | What | Visibility |
|---|---|---|
| Schema (public) | `connectorId` + a **`fields` projection** (names and types only) | browser |
| Server (`SpaceConnector` row, or `SpaceCredential.data`) | full manifest: baseUrl, paths, auth template, operators, media base | server only |
| Credential store | the secret itself | server only |

The `fields` projection is the only part the browser needs, and only so the builder can offer
typed bindings — names and types, never endpoints. A `runtime: 'server'` provider element needs
**nothing** from the manifest client-side: its data arrives through RSC already resolved.

Consequence: the browser never learns a backend URL, an endpoint shape, or an auth scheme. Not
just no tokens — **no topology**.

```jsonc
{
  "id": "cms-main",
  "credential": "strapi-prod",           // SpaceCredential.identifier — reference only
  "baseUrl": "https://cms.example.com",
  "auth": { "in": "header", "name": "Authorization", "value": "Bearer {{credential.token}}" },
  // RFC 0009 §3.8 moved `list` and `write` under an `endpoints` key and dropped the authored `id`.
  // Manifests in this shape are still read; the builder writes the current one.
  "list": {
    "path": "/api/{{resource}}",
    "query": { "pagination[start]": "{{offset}}", "pagination[limit]": "{{limit}}" },
    "itemsPath": "data",                 // data | items | docs | results …
    "totalPath": "meta.pagination.total",
    "idPath": "documentId",
    "valuesPath": "."
  },
  "pagination": "offset",                // offset | page | cursor
  "operators": { "eq": "filters[{{field}}][$eq]={{value}}" },
  "media": { "baseUrl": "https://cms.example.com" },
  "fields": { "title": "text", "body": "richText", "cover": "image" }
}
```

The engine reuses what already exists:

- **`processTwig`** for interpolating paths, headers, query and filters — already used by
  `ApiContainer` for query compilation, already covered by tests.
- The QueryBuilder's neutral `RuleGroup` as filter input, mapped through `operators`. No new
  formatter target is needed in `QueryBuilderFormatter`.
- A **server-safe path getter** for `itemsPath` / `totalPath`. It must not import
  `plitzi-ui` — pulling that barrel into the server already cost boot weight in the MCP.

`fields` is declared in the manifest in v1. That yields typed bindings without writing any
introspection code. Per-CMS schema introspection is an optional later addition and only for a
connector that earns it.

**Expressiveness ceiling:** GraphQL-only or query-language CMSs (Contentful GraphQL, Sanity
GROQ) will not fit a REST manifest. The escape hatch is a small code-adapter interface with
the same output contract, implemented only when a paying case requires it. Not built now.

### 4.3 Credentials: one generic shape

`CredentialProvider` is currently `s3 | r2 | ssr` — it names a *service*. Adding one enum value
per CMS would put a Prisma migration in the path of every new integration.

Instead, add a **single** `custom` value meaning "generic key/value bag". `SpaceCredential.data`
is already `Json`, so no further schema change is needed. Connector identity lives in the
manifest, not in the enum, so **adding a new CMS requires zero migrations and zero code**.

```prisma
enum CredentialProvider {
  s3
  r2
  ssr
  custom
}
```

Hard rules, enforced by test:

- Credentials are readable server-side only. They must never appear in `getOfflineData`, the
  deploy snapshot, the `Server` payload, or any RSC response body.
- The credential is resolved by identifier at request time and injected into the outbound
  request; the manifest only ever holds the reference.

**Resolved (2026-08-03):** `SpaceCredential.data` was stored in plaintext and is now encrypted at
rest with AES-256-GCM (`services/secrets`), keyed by `CREDENTIALS_ENCRYPTION_KEY`. Properties
worth stating, because they are what the tests pin:

- **Versioned envelope** (`v1:<iv>:<tag>:<ciphertext>`), so the key or the algorithm can be
  rotated later without guessing how an existing row was written. `rotateSecret` re-encrypts
  under a new key.
- **GCM, not CBC**: the auth tag turns a tampered credential row into a decryption failure
  rather than a silent change to what the server sends at a customer's backend.
- **Random IV per write**, so two spaces holding the same secret do not produce equal
  ciphertext.
- **Optional by configuration.** With no key set, encryption is off and the payload is stored
  as plaintext JSON; the server warns once per process on the first such write. This is a
  deliberate operator choice — it keeps local and self-hosted setups running with no key
  management — and the read path stays consistent because a non-envelope value is returned
  untouched. A deployment holding third-party credentials should set the key.
- **Legacy and plaintext rows stay readable**: a value that is not an envelope is returned
  untouched, so enabling the key does not take a running deployment down. Re-saving migrates it.
  The reverse is not symmetric — an already-encrypted row cannot be read once its key is
  removed, so keys are rotated (`rotateSecret`), never dropped.

Applied at every choke point: both credential mutations encrypt on write, and the connector
lookup plus the four S3/CDN read sites decrypt on read.

#### 4.3.1 The leak this closes

`ApiContainer` exposes `accessToken` as an **editable element attribute** — there is a plain
`<Input label="Access Token">` in its `Settings.tsx`. Element attributes are persisted in the
schema, and the schema is hydrated into the browser. So today, **any API token configured
through the builder ships to every visitor in the page payload**, on top of being sent from the
browser in an `Authorization` header by `useApi`.

This is not a hypothetical hardening exercise. It is a live credential disclosure, and it is the
single strongest reason to land Phases 0–3 before adding any further data integration.

The fix is *not* to remove the attribute. `accessToken` and `headers` stay, because a **bound**
value — typically the signed-in visitor's own token, resolved at runtime from the auth source —
never enters the schema and is a legitimate client-side call. What is unsafe is a **literal**
value typed into the builder, which is persisted and therefore public.

So the rule is by mode, not by attribute:

| Token origin | Where it lives | Safe |
|---|---|---|
| Bound at runtime (auth source, state) | resolved in the browser, never persisted | yes |
| Literal typed in the builder | the schema, served to every visitor | **no** |
| Server connector credential | `SpaceCredential`, resolved in `getRscData` | yes |

Anything secret belongs in a connector with `runtime: 'server'`, where the credential is
resolved server-side and neither the token nor the endpoint reaches the browser.

#### 4.3.2 Invariant: sdk-server is the only origin the browser talks to

`sdk-server` is the frontend's **server tier**, and that — not any deployment topology — is
what produces the security property. Stated as a testable invariant:

> For a page served by Plitzi, the browser issues requests to the Plitzi origin only. It never
> holds a credential, never learns a backend hostname, and never contacts a CMS or customer API
> directly.

Everything data-related crosses that boundary through two endpoints: `/_rsc` for reads and
`POST /_action` for writes. Both resolve credentials server-side.

This invariant is satisfied the moment Phase 1 ships, running in the existing cluster.
Geographic distribution (§8.1) changes *where* that tier executes; it adds nothing to *what* is
exposed. The two must not be conflated when scheduling the work.

### 4.4 RSC as the resolution engine

Work required on the existing pipe:

1. **Fix `buildRscCacheKey`.** It is `spaceId|environment|revision|userId|ids` and **does not
   include the request path or query**. Any route-dependent data poisons the cache across URLs
   (`/blog/a` and `/blog/b` collide). This is a correctness bug and blocks everything else.
2. **Implement `getRscData`.** Load the schema, select elements with `runtime: 'server'`,
   resolve each through the connector engine, run them in parallel with a per-element timeout
   and isolated failure (a provider outage degrades one slice, never the page), and honor the
   `ids` parameter for partial refresh.
3. **Resolve route params server-side** with `matchRoutePath` / `getRouteParams` against
   `req.path` and `schema.pages`, so filters compiled from `{{routeParams.*}}` work outside
   React.
4. **Cache provider responses** (Redis/TTL) keyed by connector + compiled query, invalidated by
   CMS webhook. Without this, every render hits a third party.

Client side: the provider element reads `elementData` from `useRscData` when
`runtime === 'server'` and must not run the client fetch hook in that mode. `mockData`
continues to drive the builder, where no `/_rsc` for the live space exists.

#### 4.4.1 Project the slice to bound paths

A provider element's purpose is to feed **bindings**: it publishes `runtime.sources[<source>]`
and descendants bind against paths inside it. Bindings are evaluated on the client, so the slice
must be serialized into the page — the *content* is necessarily exposed, and that is fine, it is
what gets rendered.

What is not fine is shipping the **whole provider response**. A CMS entry routinely carries
fields nobody bound: author emails, internal notes, unpublished translations, draft siblings.
Passing the response through untouched puts all of it in the client store and in the HTML.

So `getRscData` must **project each slice down to the paths actually bound** before returning it.
The schema already declares what is consumed — every binding carries `source` as
`<type>_<idRef>.<path>` — so the bound-path set for a provider's subtree is computable
server-side from the schema alone.

Note the existing `getBindingsDetails` in `sdk-shared/dataSource` is *not* reusable here: it
imports `plitzi-ui` and `immer` and it *evaluates* bindings against live data. Projection needs
only the static reference set, which is a separate, dependency-free collector.

Projection is **prefix-based**, not exact: a binding inside a repeated list consumes
`records[*].title`, and twig templates can index dynamically. Keep whole subtrees at the declared
prefix rather than attempting exact key matching.

Escape hatch: a connector may declare `projection: "full"` when its data feeds templates whose
paths cannot be determined statically. That is an explicit, reviewable opt-out — not the
default.

Secondary benefit: this is also the cheapest payload reduction available, since over-fetched CMS
responses are usually far larger than what a page binds.

### 4.5 Unified provider element

`CollectionContainer` and `ApiContainer` collapse into one provider element with a `connector`
attribute. Both currently publish the same binding contract, so existing bindings survive:
the element still registers `runtime.sources[<source>]` and mounts the same `StoreProvider`.

`useCollectionContext` is rewritten to read from RSC/provider data instead of GraphQL. The
component body does not change.

### 4.6 RSC transport: data-only, not Flight

`SchemaRsc.transport` already declares both options: `'json'` (default, data-only) and
`'stream'` ("uses the RSC wire format, requires the `react-server` condition"). **This RFC
implements `'json'` only**, and that is a decision, not an omission.

Data-only already delivers everything the fetch-on-the-server move is for: the credential never
reaches the browser, the HTML ships with data, and partial refresh works by `?ids=`. What true
RSC would add on top is narrower than it looks: the component's *code* stops shipping to the
browser.

For a provider element that payoff is close to zero. `ApiContainer` renders
`RootElement` + `StoreProvider` + `children` — it is a data provider, not a heavy renderer. The
bundle weight lives in the children, which stay client components either way.

What it would cost:

- **A second module graph.** `sdk-elements` (and every plugin) would need a `react-server` build
  target alongside the current one, on top of a Vite library build with `preserveModules`
  consumed as a published package by arbitrary hosts.
- **Executing third-party code on the server.** A plugin element marked `runtime: 'server'`
  would have to run inside the server process. That is precisely the extension point that does
  not exist today (`PluginManager` compiles and serves *client* assets), and introducing it
  brings the full sandboxing problem with it.
- **A break in the store chain.** The element runtime is client-reactive by construction:
  `withElement` / `useElement`, the nexus `StoreProvider inherit="live"`, bindings resolved at
  render. A server-rendered subtree cannot feed children that read from a client reactive store.

Decision: keep `transport: 'json'`. Leave `'stream'` declared and unimplemented. Revisit only
if client bundle size becomes a measured complaint — not before.

### 4.7 Write path — server actions

RSC is read-only, so the write path must be replaced **before** anything is deleted. Today
`CollectionInteractions` is the only backend-free write path and it powers forms.

Add a server-side action endpoint (`POST /_action`) taking `{ elementId, action, values }`,
resolved through a `write` section of the same manifest (create/update/delete templates), with
the credential injected server-side. It needs rate limiting, origin checks, and the existing
analytics/quota hook.

The interaction callback vocabulary (`addRecord` / `updateRecord` / `removeRecord`) is kept but
re-sourced from the provider element, so existing schemas keep working.

---

## 5. What gets deleted

| Area | Path |
|---|---|
| Package | `packages/sdk-collections` (entire) |
| Builder CMS UI | `apps/builder/src/modules/Collection/` (15 files, 1,398 LOC) |
| Interactions source | `packages/sdk-interactions/src/sources/CollectionSource/` |
| SDK context | `apps/sdk/src/modules/Collection/CollectionContextProvider.tsx` + `CollectionContext` from the service provider composition |
| GraphQL documents | `sdk-shared/network/graphql/{sdk,builder}/{Queries,Mutations}/Collection/` (~20) |
| Server resolvers | `services/graphql/schema/{queries,mutations,types}/collection*` (10 resolvers + types + list types) |
| Mongo models | `services/mongo/models/Collection.ts`, `CollectionRecord.ts` |
| SSR prefetch | the collections branch of `getOfflineData` |
| MCP catalogs | `collectionContainer` in `builtinComponents`; the `collection` source in `builtinCallbacks` — **and with it the OPEN parameter-set special case in the validator**, so every callback source becomes closed-set |
| Element | `CollectionContainer` (merged into the unified provider element) |

Kept: the contract types in `sdk-shared`, the container component, and the binding/source
machinery.

---

## 6. Phases

Each phase ships independently and is reversible on its own. Nothing is deleted before its
replacement exists.

| Phase | Work | Unblocks |
|---|---|---|
| **0** | ✅ Fix `buildRscCacheKey` (path + query in the key); implement a real `getRscData` skeleton with parallel resolution, timeouts and `ids` | Correctness debt owed with or without this RFC |
| **1** | ✅ Connector engine + manifest schema + `CredentialProvider.custom` + credential resolution and the no-leak test | Any CMS by configuration |
| **2** | ✅ Unified provider element; `useCollectionContext` reads RSC; `CollectionContainer` becomes a deprecated alias | One data path |
| **3** | ✅ `POST /_action` write endpoint + re-sourced interaction callbacks | Forms without a Plitzi backend |
| **4** | ✅ Migrate demos/templates to `createJsonAdapters` + `mockData`; **delete** everything in §5 | The simplification |
| **5** | *(deferred)* Edge split evaluation | See §8.1 |

---

## 7. Risks and trade-offs

**Read latency regression.** Collections travel inside the deploy snapshot today, so reads cost
nothing and survive third-party outages. After this change every render can involve an external
call. Mitigated by the response cache in Phase 0/1 plus webhook invalidation — but this is a
real regression to plan for, not a detail.

**Loss of backend-free writes.** Phase 3 must land before Phase 4. If demos still need a sink
afterwards, the fallback is a single append-only submissions table — explicitly *not* a CMS: no
field builder, no content manager, no field types UI.

**Manifest ceiling.** See §4.2. Accepted, with a code-adapter escape hatch left undesigned.

**Data migration.** Pre-production, so existing collection data is development-only: export to
JSON and move on. No migration tooling is warranted.

---

## 8. Non-goals

- **CMS parity.** No relations, no i18n, no editorial workflows. The commented-out
  `reference` / `multiReference` field types in `CollectionsHelper` are not to be implemented.
- **Per-CMS code connectors.** Configuration first; code adapters only when a paying case
  demands one.
- **`plitzi_render` investment.** Keep it compatible with MCP-UI / A2UI; do not grow it until
  there is a signal.

### 8.1 Edge SSR — the seam exists, the work is deferred

Edge is a *consequence* of this RFC, not a justification for it, but the path is concrete enough
to record so it is not re-derived later.

The whole of `plitzi-sdk-server` cannot run on a Workers-class runtime — Prisma/MySQL, the Mongo
driver, ioredis, Puppeteer and runtime plugin compilation to disk rule it out. But **the SSR
role can**, and the seams for it already exist:

- `createSSRServer` already isolates pages + RSC as a separate factory from the MCP and generic
  servers.
- `SSRRequest` and `SSRResponseHelpers` are **framework-neutral plain objects**, not Express
  types. The HTTP layer is already decoupled. (`write: (chunk: string | Buffer)` is the single
  Node leak, and it is trivial to widen.)
- `SSRAdapters` is an interface with **two implementations already** — `ssrAdapters` (cluster)
  and `createJsonAdapters` (standalone). **Edge is a third implementation of an existing
  interface, not a rewrite.**

What an `edgeAdapters` implementation would require:

| Concern | Today | At the edge |
|---|---|---|
| `getOfflineData` | Mongo + Redis + Prisma lookups per request | single KV/R2 read keyed by domain → revision snapshot |
| Space resolution | MySQL `Space` / `SpaceDeployment` | domain → snapshot index in KV, written at publish time |
| Plugin assets | compiled to disk at runtime (`.sdk-plugins`) | build-time artifacts served from R2/CDN |
| Analytics | direct Mongo writes | fire-and-forget to a queue |
| Connector fetches | n/a | HTTP (fine) + credential from an edge secret + response cache in KV |

**This RFC is what unblocks it**: with the Collections store gone, the snapshot becomes a pure
JSON document with no per-request database read behind it. That is the actual precondition.

Still deferred, for reasons that have not changed:

- A second runtime means a second build target and a second debugging path for the same render.
- Public spaces were recently consolidated *from* S3 + CloudFront + Lambda@Edge *into* in-cluster
  SSR. Whatever motivated that consolidation likely still applies and should be understood
  before re-splitting.
- Edge rendering that fetches a distant CMS origin is **slower** than regional rendering. Edge
  only pays off with connector responses cached in KV, which is Phase 1 work regardless.

Revisit when there is traffic that demands it. Origin keeps the write and admin plane —
builder GraphQL, Prisma/MySQL, MCP writes, deploys, Puppeteer — which is the correct split
anyway: **edge reads and renders; origin writes and administers.**

---

## 9. Success criteria

- One provider element and one data path; `CollectionContext` gone from the service provider
  composition.
- Every callback source in the MCP validator has a closed parameter set.
- A test asserts no credential value appears in the snapshot, the `Server` payload, or any RSC
  response.
- Connecting a new CMS requires **only** a manifest and a credential row — no migration, no
  deploy of new code.
- Net LOC removed exceeds LOC added.

---

## 10. Commercial follow-on (out of scope here, enabled by this)

This RFC is the simplification half. The differentiation half is **governance of agent edits**,
where the market is already moving (brand rules, design-system enforcement, sandboxed branches,
per-page/locale permissions, human-vs-AI attribution). Plitzi already has the catalogs, the
style tokens, the validator, version-conflict detection, and environments plus revisions. The
likely gaps are an **attribution log** and an **isolated preview before publish**.

That is where investment should go once there is one data path to reason about — not into more
builder surface.
