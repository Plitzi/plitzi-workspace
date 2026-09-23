# Connectors and content presentation elements

A practical guide to Plitzi **connectors** — the declarative way to read from (and optionally write to) an external
CMS — and to the elements that turn that data into publishable pages.

This is the reference for this part of the system. The design was argued in RFCs 0008 and 0009, which were deleted
once implemented; the reasoning is in the history (`git log -- docs/rfc`), and the rules live here and in the comments
of the code that enforces them.

---

## 1. Why connectors exist

Plitzi is the **presentation layer** of a headless CMS. It does not store, model or edit content — that is the CMS's
job. What it does is connect to one, fetch its records and render them.

The problem connectors solve:

- There used to be **Collections**, a content backend of Plitzi's own. It was removed entirely (commit `de367118`)
  because it duplicated the work of a CMS.
- That left a single data path: a *provider* element resolved on the **server** through a **declarative connector
  manifest**.

The central idea:

> **A connector is *data*, not code.** Everything needed to talk to a CMS (endpoint, auth, response shape, filters,
> paging, writes) is declared in a JSON document a generic *engine* interprets. Connecting a new CMS — or fixing one
> whose API changed — is editing a document, never deploying code.

---

## 2. The manifest: what it is and what it is for

The `ConnectorManifest` (`apps/server/src/modules/connectors/types.ts`) is the declarative contract describing how to
talk to one backend. The *engine* (`engine.ts`) knows nothing about Strapi or WordPress: it reads the manifest,
resolves templates and builds the request.

Main fields:

| Field | Purpose |
|-------|---------|
| `id` | The connector's identifier (what the `ApiContainer` element names). **Not authored**: the adapter stamps it when it reads the row |
| `credential` | Identifier of the credential to resolve. The secret is **never** part of the manifest |
| `baseUrl` | The API's origin |
| `auth` | Authentication scheme: `in` (`header`\|`query`), `name`, `value` (a template, e.g. `Bearer {{credential.token}}`) |
| `headers` | Static headers with template values |
| `endpoints.read` | **Named** read endpoints: `method` (full REST verb, default `GET`), `path`, `query`, `headers`, `body` + the response mapping (`itemsPath`, `totalPath`, `idPath`, `valuesPath`) and an optional `pagination` |
| `endpoints.write` | **Named** write endpoints: `method`, `path`, `query`, `headers`, `bodyPath`, `response`. **Absent = read-only** |
| `pagination` | `offset` \| `page` \| `cursor` |
| `operators` | Filter templates per operator, e.g. `eq: 'filters[{{field}}][$eq]={{value}}'` |
| `media` | `baseUrl` to rebase relative media URLs (`/uploads/x.jpg` → absolute) |
| `fields` | Field names and types; the **only** part of the manifest the browser sees (it feeds typed bindings) |
| `projection` | `'full'` as the escape hatch: serves the whole slice unprojected |

### Why it is safe

- The manifest is **server state**: it names endpoints and auth schemes and never reaches the browser.
- The client only receives the connector's `identifier` and its `fields`.
- The credential is referenced by identifier but resolved on the server.
- A connector is read-only until its manifest declares `write`; an undeclared action is **refused**, not guessed.

### Why the calls live under `endpoints`, and why they are maps

`read` and `write` describe **requests**; `auth`, `headers`, `operators` and `media` describe the **connection** and
apply to all of them. Side by side the two kinds read as equals and there is no obvious place for the next operation,
so the requests are grouped under `endpoints`.

And they are **open maps**, not a fixed `list` plus `create`/`update`/`delete`: a connector is a declarative REST
client, and an API has as many operations as it has. A CMS is just the case where the read is called `list` and the
writes are named after CRUD. A write endpoint can be called `escalate`, `publish` or `sendInvoice`; the element or the
interaction invokes it **by name**, and the server refuses (405) whatever is not declared.

The verb is the **full REST vocabulary** (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`) on both sides:
what separates a read from a write is what the endpoint is for, not which verb it uses. A search is read with `POST`,
an upsert is written with `PUT`. The body is sent except for the methods that carry none (`BODYLESS_METHODS`).

Reads and writes are separate maps on purpose: only writes are reachable through `/_action`, so a read can never be
invoked as a mutation, nor a write mounted as a data source.

The element picks its read endpoint with the `endpoint` attribute (`list` by default).

There is no compatibility with the earlier shape (`list`/`write` at the root), on purpose: a manifest is a hand-written
document of a pre-release feature, and a shim that silently upgrades it is a second shape the engine would have to
keep understanding forever. A connector written in the old layout is recreated, once.

### Presets

The builder ships starting documents (`apps/builder/src/modules/Connectors/presets.ts`): **Strapi v5**, **WordPress
REST**, **Directus**, **Contentful CDA** and **Blank**. They are documents, not adapters: they fill the editor and
every field stays editable. An outdated preset is fixed by editing a row, never with a release.

---

## 3. Architecture: the pieces

```
                       ┌─────────────────────────── B U I L D E R ───────────────────────────┐
                       │  "Connectors" panel  ──  presets  ──  manifest JSON editor          │
                       │  Credentials (CMS / Custom API) ── SpaceCredentialForm              │
                       └───────────────┬─────────────────────────────────────────────────────┘
                                       │  GraphQL: SpaceConnectors + add/update/remove
                                       ▼
                       ┌──────────────────────────── S E R V E R ────────────────────────────┐
                       │  engine.ts ── fetchConnectorRecords / writeConnectorRecord           │
                       │  resolver.ts ── the element's bridge to the engine                   │
                       │  projection.ts ── trims the slice to what the page binds             │
                       │  resolveRscData.ts ── resolves every runtime:"server" element        │
                       │  rsc/handler.ts ── /_rsc (refresh, ?location=)                       │
                       │  actions/handler.ts ── POST /_action (writes)                        │
                       └───────────────┬─────────────────────────────────────────────────────┘
                                       │  RSC payload (serverData) / responses
                                       ▼
                       ┌────────────────────────────── S D K ───────────────────────────────┐
                       │  ApiContainer (provider) ── publishes the slice as a binding source │
                       │    ├─ List (source: controlled) ── iterates records                  │
                       │    ├─ Pagination ── UI over pageInfo                                 │
                       │    └─ RichText ── the CMS body, sanitized                            │
                       └─────────────────────────────────────────────────────────────────────┘
```

### Server — `apps/server/src/modules/connectors/`

- **`engine.ts`**
  - `fetchConnectorRecords`: builds the URL by resolving templates (Twig) with `credential`, `resource`,
    `routeParams`, `queryParams`, `limit/offset/page/cursor`; applies filters through the operator templates;
    normalizes the response to `{ records, pageInfo }`; `rebaseMedia` on relative paths.
  - `writeConnectorRecord`: create/update/delete **only if** the manifest declares the action.
- **`resolver.ts`** — `createConnectorResolver`: reads the element's attributes (`connector`, `resource`,
  `singleRecord`, `filters`, `pagination`, `pageParam`…), resolves manifest + credential on the server and returns the
  slice the element will publish. An element with no connector resolves to `undefined` (a draft, not an error).
- **`projection.ts`** — `collectBoundPaths` + `projectSlice`: reduces the slice to the paths the page actually reads
  (privacy and size). `pageInfo`, `isEmpty`, `hasError` and `errorMessage` are always kept.
- **`resolveRscData.ts`** — matches the URL against `schema.pages` (the same matcher as the client router), extracts
  `routeParams` and resolves every `runtime: 'server'` element of the subtree in parallel, with a per-element timeout
  and failure isolation.
- **`rsc/handler.ts`** — `GET /_rsc`: rewrites the request with `?location=` to resolve the right page on client
  refreshes.
- **`actions/handler.ts`** — `POST /_action`: the browser sends `{ elementId, action, recordId, values }`; the server
  checks the element is `runtime: 'server'`, has a connector, and that the connector declares the action.

### Builder — `apps/builder/src/modules/Connectors/`

- **`Connectors.tsx`** — the management panel (list + form + delete confirmation). It warns when the space has no SSR
  deployment: a connector is resolved on the server, and with no server it is resolved nowhere.
- **`ConnectorsContextProvider.tsx`** — loads `SpaceConnectors` through SWR and syncs it to the builder store (so the
  element inspector sees the connectors and their operators). Every mutation revalidates the query, so the panel cannot
  be left showing something else. It also publishes `hasServerRendering`, derived from whether any `SpaceDeployment`
  uses an `ssr` credential.
- **`components/ConnectorForm/`** — name + preset + two modes over the **same document**:
  - **Basic** (`ConnectorBasicEditor`): at the top, the only things that must be filled in — **API URL** and the
    **credential**; the preset knows the rest. Below, collapsible sections (Endpoints, Auth, Paging, Filters, Media)
    with a **summary in the closed header** (`helpers/summarizeManifest.ts`), so collapsing hides no information.
    **Endpoints** (`ConnectorEndpointsEditor` + `ConnectorEndpointEditor`) lists the read and the write endpoints,
    with add / rename / delete; each carries a name, a verb, a path, query, headers, its own paging (reads) and folds
    its own response mapping. On add, the suggested name follows the real vocabulary (`list` → `detail` → `search`;
    `create` → `update` → `delete`) with a matching verb; past that, it numbers.
    Nested sections are told apart by a vertical rail running through header and content, plus indentation and a
    tint that fades with depth — indentation alone is ambiguous between two collapsed siblings.
    **Mind the section id**: `useStorage` splits the key at the first dot and treats the rest as a lodash *path*
    inside a single blob, so an id that is a prefix of another (`read.list` vs `read.list.response`) collides — one
    writes a boolean where the other needs an object, and the loser reads back `undefined` and closes. That is why the
    id is flattened to a single segment. An endpoint row's identity **is its name** (keying by position repoints every
    row after a deleted one to its neighbour's data), and so that renaming does not remount on every keystroke the name
    is edited in local state and **committed on blur**; if it is empty or taken, `onRename` returns false and the field
    goes back to the stored value. They also use `autoSync: false`: they all share the `builder-state` root, and
    otherwise one toggle notifies and re-renders every one of them.
    The panel is served in the central area, so it is centred with a max width and short fields flow in columns
    (`FieldGrid`, `auto-fill`) rather than stretching across a wide monitor. Each field's explanation is in its `title`
    (hover) and, as prose, behind each section's `?` (`FieldHelp` + `ConnectorSectionContext`); the collapsed and help
    state is remembered per section.
  - **Advanced** (`ConnectorAdvancedEditor`): the JSON exactly as it is stored, for the provider that does not fit.
  Switching modes converts nothing; it is validated on save (`helpers/validateManifest.ts`).
- **`components/TokenInput/`** — a one-line field that autocompletes the engine's tokens (`getConnectorTokens`, in
  sdk-shared). It is the part an author cannot guess: `{{offset}}` vs `{{page}}` decides whether paging works.
- **Credential**: picked with `SpaceCredentialSelectorModal` filtered to `custom`; the manifest only stores its
  identifier.
- GraphQL: `SpaceConnectorsQuery`, `SpaceAddConnectorMutation`, `SpaceUpdateConnectorMutation`,
  `SpaceRemoveConnectorMutation`.

### Builder — `apps/builder/src/modules/Credentials/`

A panel of its own (key icon) to create, list and delete credentials without going through another feature's modal.
A connector needs that order: the CMS token has to exist **before** there is a manifest that references it.

### SDK elements

- **`ApiContainer`** — the *provider*. See section 4.
- **`List`** (source `controlled`) — the repeater: one template per record under the `item` scope. There is no new
  repeater; this is it.
- **`Pagination`** — pure UI over any `pageInfo`. See section 5.
- **`RichText`** — a CMS body. See section 5.

---

## 4. How the ApiContainer works

It is the element that fetches data and publishes it as a binding source for its descendants. **One element, two
modes**, chosen in Settings with **Data Source** (`definition.runtime`):

| Data Source | Where it resolves | Typical use |
|-------------|-------------------|-------------|
| `Browser request` (`client`) | A fetch in the browser | Public APIs, generic JSON, mocks |
| `Connector (server-side)` (`server`) | On the server, through a connector + credential | Authenticated CMSs, secrets, SSR |

### Runtime lifecycle (`ApiContainer.tsx`)

1. **Identity** — `useElement()` gives `id` and `runtime`. The source name is `apiContainer_<id>`; everything the
   children bind hangs from it.
2. **Getting the data**
   - **Server**: `useRscData()` reads its own slice of the store, `rsc.data.<elementId>` (the SSR payload or a
     `/_rsc` refresh). It subscribes to its own key only: a partial refresh of another provider does not re-render it.
     The data arrives already resolved by the server (manifest + credential + filters + routeParams + paging +
     projection).
   - **Client**: `queryCompiled` resolves the template with `routeParams`/`queryParams` and `useApi` fetches. The
     response is published as `data` (the parsed body) and `status` (the HTTP status).
3. **The published slice (the contract)**

   ```jsonc
   {
     "records": [ { "id": "1", "values": { … } } ],   // list mode
     "record":  { "id": "1", "values": { … } },       // singleRecord mode
     "pageInfo": { "hasNextPage": true, "hasPrevPage": false, "from": 0, "to": 10,
                   "total": 42, "page": 1, "pageCount": 5, "nextCursor": "", "prevCursor": "" },
     "isLoading": false,
     "isEmpty": false,
     "hasError": false,
     "errorMessage": ""
   }
   ```

   A record's fields are under `values`: a row of a list reads `list_<id>.item.values.title`, a detail page
   `apiContainer_<id>.record.values.title`.

   It is mounted with a `StoreProvider` (`{ runtime: { sources: { apiContainer_<id>: slice } } }`) and
   `useRegisterSource` publishes the `SourceField`s for binding autocomplete. `isEmpty`/`hasError`/`isLoading` exist
   so empty states are authored with ordinary bindings — no slot mechanism.
4. **Paging** — `useProviderPagination` handles the `url`/`append`/`none` modes (see section 6).
5. **Interactions** — callbacks `performQuery`, `loadMore`, `goToPage`; in server mode also `writeRecord` (params
   `action` + `recordId`, it does `POST /_action`; when it finishes it invalidates the cached browser requests).
   Triggers `onApiSuccess` / `onApiError`. In client mode, with `cache: true` (off by default), the response lives in
   the `@plitzi/sdk-shared/queries` cache for `staleTime` seconds (30 by default); `performQuery` always asks again —
   see "Cached requests" in [Authoring spaces](./authoring-spaces.md).
6. **Render** — `<RootElement tag={subType}>` wraps a `<StoreProvider>` with the children.

### How it knows to wait for the RSC

1. **The shared flag.** The author sets `runtime: 'server'` in Settings. The server uses that same flag
   (`resolveRscData`) to decide which elements to resolve, and the element (`serverMode = runtime === 'server'`) to
   decide what to read. There is no "waiting": `useRscData` is subscribed to `rsc.data.<id>` in the store and
   re-renders when that slice changes.
2. **The payload's shape tells the cases apart** (`ApiContainer.tsx`):
   - `rsc.loaded === false` → the RSC never loaded (builder, client-only render or `schema.rsc.enabled` false) →
     **mock**.
   - `loaded` but the `id` is missing → the payload **did** arrive but this element did not resolve (provider down or
     misconfigured) → `emptyObject` + `hasError = true` (deliberately **not** the mock: a production outage is not
     disguised as content).
   - `id in serverData` → the server's slice.

### Security

- In server mode the browser never sees the backend URL or the secret: the data arrives already resolved in the RSC
  payload.
- A write travels as `{ elementId, action, ... }`; the server resolves the target from the published schema and
  refuses what the connector does not declare. The endpoint is not a generic proxy.

---

## 5. Related elements

### Pagination (`structure`)

Pure UI over any `pageInfo`. It **never talks to the provider directly** — which is why it also works over plugin
sources.

| Prop | Values | Note |
|------|--------|------|
| `pageInfo` | bind `{{apiContainer_x.pageInfo}}` | Everything comes from here |
| `mode` | `pages` \| `loadMore` | Numbered pager or a "load more" button |
| `target` | `url` \| `interaction` | Navigates by itself, or only emits `onPageChange` |
| `pageParam` | string | Must match the provider's |
| `windowSize` | number | Pages around the current one |

It emits the `onPageChange` trigger. In the builder (no data) it renders its controls disabled, so the element can be
styled when selected.

### RichText (`basic`)

Renders a CMS body. It is **not** `BlockHtml` (which runs `<script>` on purpose — right for authored embeds and
unacceptable for third-party content).

- `content` — the body, bound from the provider.
- `format` — `html` \| `markdown` \| `text` (Strapi returns HTML or markdown depending on the editor; Contentful and
  Ghost HTML; others text).
- `mediaBaseUrl` — prefix for relative `src`/`href` inside the body (the connector rebases record fields, but the
  markup inside a body is opaque to it).

It sanitizes: strips `<script>`, event handlers and `javascript:` URLs, and rebases relative media.

---

## 6. Paging: URL vs append

Both modes share **one path on the server**: the page parameter is read from the request's query string.

| Mode | Behaviour | Indexable | Use |
|------|-----------|-----------|-----|
| `url` | The pager writes `?<pageParam>=N` (`page` by default); the server resolves that window in SSR | Yes | Blog indexes, listings |
| `append` | The `ApiContainer` accumulates in browser state and asks the server only for the next slice | No | "Load more" / infinite |

Details:

- Two lists on one page use different `pageParam`s to page independently.
- `useProviderPagination` keys the accumulation by the page **the server reports**, not by a local counter: a full
  refresh goes back to page 1 and resets the list, which is what makes navigating away and back behave.
- A `cursor` provider cannot address a window by ordinal: the client forwards the token under the element's own
  parameter (`<pageParam>Cursor`) instead of reusing the page number.

---

## 7. A `/posts/:id` detail page, preloaded by SSR

The use case that ties every piece together: a URL like `/posts/123` that, **on first load, already carries the post
resolved** — no spinner, no initial fetch. The preload happens on the server during SSR: the data goes into the HTML
and the client only hydrates.

### 7.1 Authoring

1. Create a page with slug `posts/:id` (or inside a `posts` folder with slug `:id`). The route param is called `id`.
2. Inside it, a server-mode **ApiContainer** (**Data Source = Connector (server-side)**) with:
   - `connector` — the CMS connector.
   - `resource` — the content type, e.g. `posts`.
   - **Single record ON** — publishes `record` instead of `records`; the resolver forces `limit=1` and page 1.
   - A filter: field `id`, operator `eq`, value `{{routeParams.id}}`. Settings autocompletes the token because it
     reads it from the slug.
   - Pagination: `none`.
3. Bindings inside the page: the title `{{apiContainer_<id>.record.values.title}}`, the image
   `record.values.cover.url`, and the body in a **RichText** with `content` = `{{apiContainer_<id>.record.values.body}}`
   and the `format` the CMS returns.

### 7.2 What happens on load (the preload)

1. `GET /posts/123` reaches the SSR server (`plitzi-sdk-server`).
2. `buildServerInfo` (`apps/server/src/helpers/buildServerInfo.ts`) calls `config.adapters.getRscData({ req, … })` —
   one `SSRRscContext`, with `loadOfflineData` to share the space read the render already started — which invokes
   `resolveRscData`.
3. `resolveRscData` (`apps/server/src/modules/rsc/resolveRscData.ts`):
   - `getPaths` produces `/posts/:id` (the slug is parsed: `{{id}}` → `:id`).
   - `matchRoutePath` matches `/posts/123` against `/posts/:id` and extracts `routeParams = { id: '123' }`
     (`matchPath.ts` is a react-router clone; the same matcher the client router uses).
   - It collects the page's subtree and keeps the `runtime === 'server'` elements → your ApiContainer.
4. The resolver (`apps/server/src/modules/connectors/resolver.ts`):
   - Reads the element's attributes (connector, resource, singleRecord, filters).
   - `getConnector` → the manifest, `getCredential` → the secret (**neither** leaves the server).
   - Calls `fetchConnectorRecords` with the `routeParams`.
   - `resolveFilters` (`engine.ts`) renders the filter value: `{{routeParams.id}}` → `'123'`; the operator template
     then produces `filters[id][$eq]=123`.
   - Fetch from the CMS → normalize → `singleRecord` publishes `{ record, pageInfo, isEmpty, ... }` → `projectSlice`
     trims it to the paths you bound.
5. That slice goes into `serverData[elementId]` and is **embedded in the HTML** inside `server.ssr.rscData`. Beside it
   travels `server.ssr.rscPath` (`buildServerInfo` → `resolveRscEndpoint`), which is how the client knows this origin
   has an RSC endpoint.
6. Client: `Sdk.tsx` calls `useRscSync(server?.ssr)`, which projects that bootstrap into the store (`rsc.enabled`,
   `rsc.endpoint`, `rsc.data`, `rsc.loaded`) on the first render. The server ApiContainer finds its `elementData` and
   paints the post at once — no fetch, no initial loading state.

### 7.3 Later navigation

When the visitor navigates client-side to `/posts/456`, `useRscSync` notices because its key is the **location** (it
reads `runtime.sources.navigation`, not the `currentPageId`: `/posts/1` → `/posts/2` is the same page with another
record) and does `GET /_rsc?location=/posts/456`; the handler rewrites the request to that page (`rsc/handler.ts`),
the whole resolution runs again and the new slice is **merged** into `rsc.data`.

### 7.4 Edge cases

- **A post that does not exist**: `singleRecord` with no record → `isEmpty: true`, but the response is **HTTP 200**
  (the `notFoundStatus` flag is not implemented in the resolver yet). The author can bind a "not found" block's
  visibility to `{{apiContainer_<id>.isEmpty}}`.
- **An unresolved filter**: if `{{routeParams.id}}` does not resolve, `resolveFilters` marks it `unresolved` and an
  empty window is returned — better than returning the whole collection.
- **A render with no server** (client-only embed, builder, MCP widget): there is no `server.ssr.rscPath`, so
  `rsc.enabled` stays false — no fetch to `/_rsc` (a 404 against the host site) and no freezing of the
  `runtime: 'server'` elements against a server HTML that never existed. The server provider falls back to its mock,
  as in the builder.
- **Security**: neither the CMS URL nor the credential reaches the browser; the client only sees the projected slice.

---

## 8. Step by step

### 0. Prerequisite

The space is served with SSR/RSC on. The server (`plitzi-sdk-server`) must inject the `getConnector` /
`getCredential` lookups (`createConnectorResolver`).

### 1. Create the credential (the secret)

Side panel **Credentials** → *New Credential*. Provider **CMS / Custom API** (`SpaceCredentialForm.tsx`): a name + JSON
with the keys the manifest will use, e.g. `{ "token": "…" }`. It is stored under an `identifier`, encrypted at rest
(`SpaceCredential.encryptedFields`). The secret never reaches the browser and never enters the manifest.

### 2. Create the connector

Side panel **Connectors**:

1. **New Connector**.
2. Pick a preset (**REST API**, **Strapi v5**, **WordPress REST**, **Directus**, **Contentful CDA**, **Blank**).
3. In **Basic**: **API URL** and the credential (the key button). The rest comes from the preset and is collapsed:
   **Endpoints** (add/rename/delete the read and the write ones, each with method, path, query, headers and response
   mapping), **Auth**, **Paging**, **Filters** and **Media**. Template fields autocomplete tokens; each one's
   explanation is on hover and, as prose, behind the section's `?`.
4. **Advanced** holds the same document as JSON, for whatever the form does not cover.
5. Save (mutation `SpaceAddConnector`). It is validated first: a base URL, at least one read endpoint and a path on
   every endpoint, and no `{{credential.…}}` without a credential picked — otherwise it authenticates as nobody and
   the page sees it as "the API refused us".

### 3. The index page (a listing)

1. Drop an **ApiContainer**.
2. Settings (`ApiContainer/Settings.tsx`): **Data Source = Connector (server-side)**, pick the connector, the read
   **endpoint** (shown only when the connector declares more than one; `list` by default), `resource` (`posts`),
   `limit`, **Pagination = URL (indexable)**.
3. Inside it, a **List** (source `controlled`) bound to `{{apiContainer_<id>.records}}`, with one card per record:
   a heading bound to `list_<listId>.item.values.title`, an image to `item.values.cover.url`, and so on.
4. Add a **Pagination** bound to `{{apiContainer_<id>.pageInfo}}`, mode `pages`, target `url`. A click navigates to
   `?page=N`; the server resolves that window (SSR, indexable, the back button works).

### 4. The detail page

The full walk-through with SSR preloading is **section 7** (the `/posts/:id` page). In short: a page with a
parameterized slug, an **ApiContainer** with **Single record ON** + the filter `slug eq {{routeParams.slug}}` (the
filter is a template resolved on the server — it is the whole detail mechanism), a **RichText** bound to the body, and
a "not found" visibility bound to `isEmpty`.

### 5. Writes (optional)

When the manifest declares write endpoints, the server `ApiContainer` exposes **one** `writeRecord` callback with
params `action` (the endpoint's name: `create`, `escalate`, `sendInvoice`…) and `recordId`. It is one and not three
because the names are chosen by whoever writes the manifest; three fixed verbs would only suit the connectors that
happened to use them. Wire it from a button or a form through interactions: the browser does `POST /_action` with the
element's id and the action's name — never a URL, a connector or a credential — and the server validates the whole
chain and refuses (405) what the manifest does not declare.

### 6. Publish

`resolveRscData` matches the URL → `routeParams` → resolves every `runtime: 'server'` element (per-element timeout) →
a slice projected to what is bound → HTML + store. The client only refreshes through `/_rsc?location=…&page=N`.

Publishing also **copies each manifest** to a row tagged `(environment, revision)`, exactly as it does with the
schema, the style and the actions. The live row — `main`, revision 0 — remains the draft the builder edits.

### 6.1 Manifests are versioned with the deploy

Which version is read is decided by what starts the read:

| Started by | Reads |
| --- | --- |
| A page — a `runtime: 'server'` element, a `/_rsc`, a `/_action` | the manifest that page was published with |
| A webhook, a cron, a deployment's own trigger | the draft |

The second row is deliberate: nothing in an external sender or a clock names a revision, and pinning one would leave a
frozen flow talking to an integration its author has since fixed. An action and the manifests its steps go through
come from the **same** revision: mixing versions inside a run is the same mismatch in miniature.

A revision with no copy — a space published before this existed — falls back to the draft, which is what it did
before. It dies out on its own: as soon as that space publishes again, it has its own version.

**Operational consequence:** fixing a manifest because the CMS changed its API fixes the draft. Pages already published
keep reading through the manifest they shipped with **until you publish again**.

### "Load more" variant

On the `ApiContainer`, **Pagination = Load more**; add a `Pagination` in `loadMore` mode with target `interaction`,
and connect its `onPageChange` trigger to the provider's `loadMore` callback (accumulates on the client, not
indexable).

---

## 9. Code paths at a glance

| Piece | Path |
|-------|------|
| Manifest types | `apps/server/src/modules/connectors/types.ts` |
| Engine (read/write) | `apps/server/src/modules/connectors/engine.ts` |
| Resolver (the RSC bridge) | `apps/server/src/modules/connectors/resolver.ts` |
| Slice projection | `apps/server/src/modules/connectors/projection.ts` |
| RSC resolution | `apps/server/src/modules/rsc/resolveRscData.ts` |
| `server.ssr` injection (rscData + rscPath) | `apps/server/src/helpers/buildServerInfo.ts` |
| RSC endpoint publication | `apps/server/src/core/services/resolve.ts` (`resolveRscEndpoint`) |
| Route matcher (client/server) | `packages/sdk-shared/src/navigation/matchPath.ts` + `routes.ts` |
| `/_rsc` endpoint | `apps/server/src/modules/rsc/handler.ts` |
| `/_action` endpoint | `apps/server/src/modules/actions/handler.ts` |
| Builder panel | `apps/builder/src/modules/Connectors/` |
| Presets | `apps/builder/src/modules/Connectors/presets.ts` |
| CMS credential | `apps/builder/src/modules/Space/Models/SpaceCredentialForm.tsx` |
| Provider element | `packages/sdk-elements/src/elements/provider/ApiContainer/ApiContainer.tsx` |
| Provider settings | `packages/sdk-elements/src/elements/provider/ApiContainer/Settings.tsx` |
| Provider paging | `packages/sdk-elements/src/elements/provider/ApiContainer/hooks/useProviderPagination.ts` |
| Provider writes | `packages/sdk-elements/src/elements/provider/ApiContainer/hooks/useProviderWrite.ts` |
| Pagination element | `packages/sdk-elements/src/elements/structure/Pagination/Pagination.tsx` |
| RichText element | `packages/sdk-elements/src/elements/basic/RichText/RichText.tsx` |
| RSC bootstrap → store (client) | `packages/sdk-shared/src/server/rsc/useRscSync.ts` |
| RSC refresh (client) | `packages/sdk-shared/src/server/rsc/refreshRsc.ts` + `useRscRefresh.ts` |
| Interaction sources | `packages/sdk-interactions/src/InteractionsSourcesProvider.tsx` |

---

## 10. Key concepts in one line

- **Manifest** → the only document to touch to connect a CMS or fix one whose API changed; the fix reaches published
  pages when you publish again, not before.
- **Slice** → the object the provider publishes; it is the contract List, Pagination and RichText bind to.
- **`runtime: 'server'`** → the flag shared by the server (what to resolve) and the element (what to expect).
- **Projection** → the server sends only what the page binds.
- **`/_action`** → the browser names an *element*, never a URL or a credential; the server decides.
- **`/_rsc`** → the client refresh carries `?location=` so the server knows which page the visitor is on.
- **`server.ssr.rscPath`** → published by the server that rendered the page; without it there is no RSC in that render,
  however `enabled` the schema is.
- **`rsc` in the store** → the live truth of the payload (`rsc.data.<elementId>`); `server.ssr` is only the bootstrap.
