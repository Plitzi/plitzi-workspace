# RFC 0009 — CMS presentation elements

- **Status:** Implemented
- **Author:** Carlos Rodriguez
- **Date:** 2026-08-03
- **Scope:** `@plitzi/sdk-elements`, `@plitzi/sdk-shared`, `apps/server`, `apps/builder`, and `plitzi-sdk-server`
- **Follows:** [0008](./0008-data-providers-and-collections-removal.md)

---

## 1. Summary

RFC 0008 removed the Collections backend and left one data path: a `runtime: 'server'`
provider element resolved through RSC by a declarative connector manifest. It delivered the
**transport**. It did not deliver the **product**: today no part of that path is reachable
from the builder, and the element set cannot express the two pages every content site needs —
an index and a detail page.

This RFC closes that gap. Its goal is stated positively:

> Plitzi is the universal presentation layer for headless CMSs. Connect the CMS you already
> run, bind fields visually, ship an index page and a detail page.

Concretely: make the server provider authorable, teach it pagination and single-record
routing, and add the two elements a content page cannot be built without.

Non-goal restated from 0008: Plitzi does not store, model, or edit content. Everything here is
presentation.

---

## 2. Starting point (measured)

What 0008 shipped and works:

- `fetchConnectorRecords` / `writeConnectorRecord` — manifest-driven read and write.
- `resolveRscData` — matches the request path against `schema.pages`, selects
  `runtime: 'server'` elements from that page's subtree, resolves them in parallel with
  per-element timeouts and isolated failure, honours `?ids=` for partial refresh.
- `createConnectorResolver` — reads the element's own attributes, resolves manifest and
  credential server-side, projects the slice down to the paths the subtree actually binds.
- `POST /_action` — element-addressed writes, credential resolved server-side.
- `ApiContainer` — publishes `runtime.sources[apiContainer_<idRef>]`, mounts a `StoreProvider`,
  exposes `performQuery` / `createRecord` / `updateRecord` / `removeRecord`.
- `List` with `source: 'controlled'` — renders one template per record under a per-row scope.
  **This is already the repeater; nothing new is needed to iterate records.**

What is missing, and why each blocks the blog:

| # | Gap | Consequence |
|---|---|---|
| 1 | `ApiContainer/Settings.tsx` exposes none of `connector`, `resource`, `filters`, `limit`, `singleRecord`; `definition.runtime` has no control anywhere | the server path is authorable only by hand-editing schema JSON |
| 2 | No connector CRUD: `grep -rn connector apps/builder` returns nothing, and `SpaceConnector` has no GraphQL | a manifest can only be created with a SQL client |
| 3 | The resolver ignores offset/page/cursor | there is no page 2 |
| 4 | `renderFilters` interpolates `{{value}}` with the filter's **literal** value | `{{routeParams.slug}}` reaches the CMS as that literal string — **the detail page cannot work at all** |
| 5 | `RscProvider` refreshes against `/_rsc` with no page path | `resolveRscData` matches `/_rsc` against `schema.pages`, finds nothing, and returns `{}` — every client-side refresh silently yields no data |
| 6 | Nothing renders a CMS rich-text body | `Markdown` takes a string; `BlockHtml` is authored HTML and deliberately executes `<script>` |
| 7 | Relative media URLs (`/uploads/x.jpg`) are published unchanged | every CMS image is broken |
| 8 | A `singleRecord` provider that resolves nothing renders an empty page with HTTP 200 | soft 404s, indexed |

Gaps 4 and 5 are correctness bugs in shipped code, not new features. They are listed first in
the phasing for that reason.

---

## 3. Design

### 3.1 The provider slice is the contract

`ApiContainer` publishes one object per provider element, and every element downstream reads
it through ordinary bindings. Widening that object is how capability is added, because it costs
no new coupling:

```jsonc
{
  "records": [ { "id": "1", "values": { … } } ],   // list mode
  "record":  { "id": "1", "values": { … } },       // singleRecord mode
  "pageInfo": { "hasNextPage": true, "hasPrevPage": false, "from": 0, "to": 10, "total": 42,
                "page": 1, "pageCount": 5, "nextCursor": "", "prevCursor": "" },
  "isLoading": false,
  "isEmpty": false,
  "hasError": false,
  "errorMessage": ""
}
```

`isLoading` / `isEmpty` / `hasError` are what make empty and error states authorable with the
elements that already exist: bind a container's `visibility` to `{{apiContainer_posts.isEmpty}}`.
This is deliberately *not* a new slot mechanism — elements have a flat item list, not named
slots, and inventing slots for this one element would be a worse trade than four booleans.

`pageInfo` gains `page` and `pageCount` because a pager cannot be rendered from cursors alone.

### 3.2 Authoring the server provider

`ApiContainer/Settings.tsx` grows a **Data** section, shown when the element is server-driven:

| Control | Attribute | Source of options |
|---|---|---|
| Runtime | `definition.runtime` | `client` \| `server` |
| Connector | `connector` | `SpaceConnectors` query (builder network) |
| Resource | `resource` | free text; the CMS content type (`posts`) |
| Filters | `filters` | rows of *field / operator / value*; operators come from the selected manifest's `operators` keys |
| Limit | `limit` | number, default `10` |
| Single record | `singleRecord` | switch — feeds a detail page |
| Pagination | `pagination` | `none` \| `url` \| `append` |
| Page parameter | `pageParam` | query-string key, default `page` |

Filter **values are templates**, resolved server-side against `routeParams`, `queryParams` and
`credential`. `{{routeParams.slug}}` is the whole detail-page mechanism.

A deliberate choice: filters are *field / operator / value* rows, not the `QueryBuilder` used by
`when`. `QueryBuilder` produces a `RuleGroup` with nested groups and OR, and the manifest's
operator model is a flat AND-only list of query parameters. Flattening a `RuleGroup` into it
would silently discard OR semantics an author could see on screen. The rows express exactly what
the manifest can execute — no more, and nothing that lies.

Only `fields` (names and types) and the connector *id* ever reach the browser. Endpoints, auth
schemes and credentials stay server-side, per 0008 §4.2.

### 3.3 Pagination — URL and append

Both modes, because they answer different needs and share one server path.

**URL mode** (default for indexes). The pager writes `?<pageParam>=N` through
`NavigationContext`. The resolver reads it from `queryParams`, computes `offset = (page-1) * limit`,
and the page renders server-side with that window: indexable, shareable, back-button correct.
Two lists on one page get distinct `pageParam`s.

**Append mode** ("load more" / infinite). `ApiContainer` holds an accumulated record array in
element state and calls `refresh([id])` with the next page; the RSC request carries the page
parameter, and the returned slice is concatenated rather than replacing. Not indexable — which
is exactly why it is not the default.

Server-side, one code path serves both: the page parameter is read from the request's query
string in either case.

`Pagination` (§3.5) is pure UI over `pageInfo` and never talks to the provider directly. In URL
mode it navigates; in append mode it fires an `onPageChange` trigger the author wires to the
provider's `loadMore` callback. That keeps it usable over *any* `pageInfo`-shaped source,
including a plugin's.

### 3.4 Detail pages

A detail page is a page whose slug carries a parameter (`/blog/:slug`) plus a provider with
`singleRecord` and a filter `slug eq {{routeParams.slug}}`. `resolveRscData` already resolves
route params server-side with the same matcher the client router uses, so the only fix needed is
gap 4: render filter *values* as templates before applying the operator template.

**Not found.** A `singleRecord` provider that resolves no record sets `isEmpty`, and — when its
`notFoundStatus` attribute is on — signals the SSR response to answer `404`. A missing post must
be a 404, not an empty 200; anything else pollutes the index of a content site, which is the
market this RFC is aimed at.

### 3.5 Two new elements

**`RichText`** (`basic`). Renders a CMS body: HTML string in, sanitized DOM out. It is *not*
`BlockHtml` — `BlockHtml` extracts and executes `<script>` on purpose, which is correct for
author-controlled embeds and unacceptable for third-party content. `RichText` strips scripts,
event handlers and `javascript:` URLs, and rebases relative media URLs. It also accepts
`format: 'html' | 'markdown' | 'text'` so one element covers the three shapes CMSs return.

**`Pagination`** (`structure`). Binds a `pageInfo`, renders prev / next / numbered pages or a
single "load more", and emits `onPageChange` / `onNext` / `onPrev`.

Nothing else is added. `List` already repeats, `Image` / `Heading` / `Link` already bind, and the
old `CollectionContainer` is not coming back — it was a second copy of the provider element.

### 3.6 Media URLs

CMSs return relative media paths. The engine rebases them when the manifest declares
`media.baseUrl`, using a rule narrow enough to be predictable:

> a string value is rebased only if its **key** is `url`, `src`, `href` or ends with `Url` /
> `Src` (case-insensitive), **and** its value starts with `/`.

Key-based, not value-based: a body field containing `/something` is never touched, which a
"rewrite anything starting with a slash" rule could not promise. Covers Strapi (`cover.url`,
`formats.thumbnail.url`), Directus, Payload.

### 3.7 Connector management

`SpaceConnector` gains GraphQL CRUD (`SpaceConnectors` query; add / update / remove mutations),
builder-role only, mirroring `SpaceCredential`. The builder gets a **Connectors** panel in the
same place the Collections manager used to live — one screen listing connectors with a manifest
editor and a credential picker.

The manifest is edited in two modes over the same document. **Basic** is a sectioned form —
connection, authentication, reading, pagination, filters, media, writes — with one line of prose
per field, because the questions an author actually has ("where do the records live in the
response?") are not answered by a JSON key. **Advanced** is the stored JSON, for the provider the
form does not cover. Switching modes is not a conversion.

Template fields complete the engine's tokens (`getConnectorTokens`, shared so the catalog and the
engine cannot drift). This is the part an author cannot guess: `{{offset}}` versus `{{page}}`
decides whether paging works at all, and nothing on screen says which one this provider wants.

Presets are *starting documents*, not code: picking "Strapi v5" fills the manifest fields in, and
the author can edit every one of them. A preset that turns out to be wrong is a data fix, never a
release.

**Credentials get their own panel.** They were reachable only from the modals that consume them —
a deployment form, a CDN row — so a secret could not be created before the thing needing it
existed. A connector requires exactly that ordering: the CMS token has to exist before there is a
manifest to reference it from. The connector form picks a credential rather than taking a typed
identifier; the manifest stores the reference and never the secret, which is also the only
arrangement where the secret stays encrypted at rest (`SpaceCredential.data`) while the manifest
does not.

### 3.8 Manifest layout: `endpoints`

`list` and `write` sit under `endpoints`, not at the root beside `auth`, `headers`, `operators`
and `media`. Those describe the *connection* and apply to every call; `list` and `write` describe
individual *calls*. Flat, the two kinds read as peers and there is no obvious place to put the
next operation.

Manifests written before the move are upgraded on read (`normalizeManifest`) rather than
rejected, and the builder writes the current shape back — so the shim stops firing on its own.

`id` leaves the authored document entirely. A connector's identity belongs to the row that stores
it; a document carrying its own id can disagree with the identifier it was fetched by, and would
then name the wrong connector in every error the engine reports. The adapter stamps it on read.

### 3.9 Connectors need a server

A connector resolves during the server render. A space published without server rendering has no
server to resolve it, so both the Connectors panel and the provider element's settings say so,
driven by whether any `SpaceDeployment` carries an `ssr` credential rather than by a flag. The
builder preview still resolves connectors — which is exactly why the warning is worth showing:
without it the feature works in the editor and silently returns nothing in production.

---

## 4. Non-goals

- **No content editing.** No field builder, no record forms, no media library. Content is the
  CMS's job — that is the whole point of 0008.
- **No per-CMS code.** Presets are manifests. The code-adapter escape hatch from 0008 §4.2 stays
  undesigned until a paying case needs GraphQL or GROQ.
- **No RSC Flight transport.** 0008 §4.6 settled this; unchanged.
- **No new repeater.** `List` controlled is it.

---

## 5. Phases

| Phase | Work |
|---|---|
| **0** | Gaps 4 and 5 — filter-value templating, and the RSC refresh carrying the page path. Correctness debt owed regardless of the rest |
| **1** | Slice widening (`isLoading` / `isEmpty` / `hasError`, `page` / `pageCount`), pagination on the resolver, media rebasing, 404 signal |
| **2** | `ApiContainer` authoring UI, `Pagination`, `RichText` |
| **3** | `SpaceConnector` GraphQL CRUD + builder Connectors panel + presets |
| **4** | Authoring usability: basic/advanced manifest editor, token completion, per-field prose, credential picker, Credentials panel, `endpoints` grouping, server-rendering warning |

---

## 6. Risks

**Preset rot.** A CMS changes its response shape and a preset silently returns nothing. Mitigated
by the manifest being data — a fix is an edit, not a deploy — but presets need a test that pins
each one against a recorded response.

**Append mode and RSC caching.** Accumulated state lives in the browser while the RSC cache is
keyed by request. A cache hit for page 2 is correct; a stale one is visible as a duplicated
record. Bounded by the existing TTL and worth a test.

**The projection and pagination interact.** `collectBoundPaths` projects to bound prefixes; a
pager binds `pageInfo.*`, which must therefore survive projection. It does today because
`pageInfo` sits at the slice root, but it is now load-bearing and needs a test saying so.
