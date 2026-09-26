# RFC 0017 — Native mobile apps (Android / iOS)

- **Status:** Proposal
- **Author:** Carlos Rodriguez
- **Date:** 2026-09-24
- **Scope:** a new, self-contained native project (`mobile/`, outside the Yarn workspaces), plus later platform work in
  `sdk-authoring` (mobile profile), `sdk-shared` / `sdk-interactions` (conformance fixtures), `apps/server` and
  `plitzi-sdk-server` (schema delivery, shared logic across spaces)
- **Supersedes:** RFC 0001 (a React Native renderer reusing `sdk-elements`; deleted, kept in the git history)

---

## 0. How to read this document

This RFC was written at the end of a long exploratory conversation, so that the next working session can start
building without re-deriving anything. It records the **ideas, the discussion, the decisions and the evidence**, not
only the plan.

- Want to know **what is settled?** → §3 Decisions.
- Want to **start the POC?** → §11 POC plan, then §14 kickoff checklist.
- Want to know **why** something is the way it is → §6 Evidence and §4 Discussion.

Everything marked **Decided** was stated by the author. Everything marked **Proposed** is the recommendation of the
analysis and still needs a yes/no. Everything marked **Open** is unresolved.

---

## 1. Summary

Plitzi builds web-apps from a schema: a tree of elements stored as data, with declarative logic (interactions,
bindings, twig templates, server actions) and a backend that runs on the server. Customers regularly ask for a
**web-app plus a mobile app** for the same business — the canonical example is a restaurant whose back office runs on
the web while waiters take orders on phones and tablets.

This RFC proposes **native mobile apps per OS** (Kotlin + Jetpack Compose on Android, Swift + SwiftUI on iOS) that
render **a separate mobile space** built in Plitzi, from **a closed element catalog** owned by Plitzi, and talk to the
same backend over its API.

The conclusion of the analysis: **feasible, and coherent with the architecture, but a large piece of new work.** The
monorepo needs almost no changes; what is large is building a native client runtime — above all, the logic that is
JavaScript today (the twig interpreter and the interactions engine) has to exist on the device.

---

## 2. Background — how this RFC came about

The conversation (2026-09-24) went through these stages, in order. They are kept because each one narrowed the
design.

1. **"Could Plitzi work with a native mobile SDK?"** A first survey of the packages measured how much of each touches
   the DOM (§6.4). The conclusion: the data and logic layers are portable, the render layers (`sdk-elements`,
   `sdk-style`) are not, and **styling is the deep problem, not components**. Three paths were laid out: WebView shell
   (+ host bridge), React Native renderer, fully native (SwiftUI/Compose).
2. **"Mobile would not use `sdk-elements`; that is the web area."** The question became: how much of the *ecosystem*
   is shared if mobile has its own catalog? Answer: the schema model, interactions, twig, nexus, the backend and auth
   all fit; the adaptations are small (storage, location), except styles.
3. **"Mobile would only be an interactive interface that talks to the backend via API."** This removes SSR, RSC,
   `runtime: 'server'`, `customCss`, raw HTML/JSX elements and plugins from scope. Three concerns remained: data
   that the web resolves server-side must come through queries/actions on mobile; the supported subset must be an
   explicit contract; and **versioning** — the catalog ships inside the binary while the schema comes from the
   server, and users do not update apps promptly.
4. **"The mobile app would be a completely separate space."** Agreed as the clean option. It surfaced the one data
   model issue: server actions, connectors and credentials are **per space** today (§6.7), so two spaces would
   duplicate the customer's backend logic.
5. **The restaurant example** (§5) was walked through feature by feature, which surfaced two requirements the web does
   not have: **offline** (restaurant Wi-Fi drops; an order must never be lost) and **real-time** ("table 4's dish is
   ready").
6. **"On mobile we will not allow custom elements."** A closed catalog makes versioning, validation, style
   translation, security and store review tractable (§3, D4).
7. **"Is it possible?" / "Does Plitzi have a future?"** Opinions recorded in §4.
8. **A React Native POC was started** inside the monorepo (`mobile-poc/`, outside the workspace globs) and the key
   question was answered empirically: the **published** `@plitzi/*` packages bundle for Android with Metro/Hermes
   **with zero changes** (§6.9).
9. **"We will not use React Native. They will be apps native to the OS (Android / iOS)."** This changes what is
   reused: no JavaScript runs on the device unless an engine is embedded, so the client-side logic has to be ported
   or embedded (§8.2). The author asked to be warned if this meant large changes; the answer given was: *feasible, but
   large — though the monorepo needs almost nothing; the size is in building the native runtime.*
10. **The Expo folder was deleted** and this RFC was requested to carry the whole context into the next session.

---

## 3. Decisions

| # | Decision | Status | Rationale |
|---|---|---|---|
| D1 | Mobile apps are **native to each OS**: Kotlin + Jetpack Compose (Android), Swift + SwiftUI (iOS). **No React Native.** | Decided | Author's call. The reason for rejecting RN was not stated — see Open question O1. |
| D2 | A mobile app is **a separate space** from the web-app. No single tree rendered on both. | Decided | Mobile UX (stacks, tab bars, sheets, gestures) differs; one tree for both ends in the lowest common denominator. |
| D3 | The mobile app is **an interactive interface that talks to the backend over the API**. No SSR, no RSC, no server-rendered data. | Decided | Keeps the device thin; the backend is already server-side. |
| D4 | **Closed catalog on mobile**: no custom elements, no plugins, no `BlockHtml` / `BlockJsx` / `NodeHtml` / `Custom`. | Decided | Plitzi controls every element: versioning = app version, exhaustive validation, only data is downloaded (never code). |
| D5 | Mobile does **not** use `sdk-elements` (nor `sdk-style`'s CSS output). | Decided | They are the web area. |
| D6 | The POC is built in a **next session**. The React Native exploration folder was deleted. | Decided | — |
| D7 | Primary device for testing is **Android** (the author has no iPhone). The POC is Android-first. | Decided | — |
| D8 | Validate with a **real use case** (the restaurant waiter flow) before generalising. | Proposed | Focus is the main risk of the project; a real flow is both the product proof and the sales argument. |
| D9 | The client logic engine is written **once in Kotlin Multiplatform (KMP)**, with native UIs on top. | Proposed | See §8.2 for the comparison with embedding QuickJS. |
| D10 | Parity with the web is enforced by a **shared conformance suite** (JSON fixtures run by JS and Kotlin). | Proposed | Without it, web and mobile will evaluate the same space differently, silently. |
| D11 | Backend logic shared by both spaces moves to the **workspace** (actions, connectors, credentials). | Proposed (leaning) | See §9.5; options (a) and (c) remain valid. |

---

## 4. Discussion and opinions recorded

### 4.1 On Plitzi as a product

Recorded as given, because they frame why mobile matters:

- **Strengths.** The schema-as-data decision is the most valuable one in the project: it is what enables the MCP,
  the JSON→authoring export, templates, the single linter with four consumers, and offline rendering. Logic is
  declarative (interactions, bindings, twig, server actions, named sources), not arbitrary JSX. AI is designed in (the
  MCP co-worker, generated guide, visual preview, "never silent" authoring).
- **AI positioning.** Code generators (Lovable, Bolt, v0) produce code someone must maintain. Plitzi produces a
  validated schema an agent can author and a person can keep editing visually, with backend and hosting included.
- **Market.** Bubble — the closest comparable — shows people pay to build web-apps without code, and it has moved
  towards native mobile too. The web + app demand seen from customers is not an outlier.
- **Risks.** Not technical: **distribution** (go-to-market is still pending), **positioning** ("website builder" is
  saturated; "platform for agencies/developers to deliver web-app + mobile app to their clients, with AI" is a
  concrete gap), and **focus** (a very large surface for the team's size).
- **Verdict given:** technically Plitzi has earned the right to a future; what remains to be proven is commercial.

### 4.2 On mobile specifically

- Mobile makes the pitch stronger: *"your web-app and your mobile app, one backend, one brand, one logic vocabulary,
  built in the same place."*
- With D2–D4, mobile becomes **one more consumer of the ecosystem** (like the builder, the MCP and the desktop app),
  not a separate product.
- Main risk: focus. Hence D8.

### 4.3 Paths considered and why they were set aside

| Path | What it is | Why not (now) |
|---|---|---|
| WebView shell (Capacitor-like) + host bridge | Package the SSR output; native capabilities via `hostAction` | Cheapest, covers ~80% of "we want an app" — but not native. Still a valid fallback for customers who only need presence in the stores. |
| React Native renderer (RFC 0001, and the 2026-09-24 probe) | RN elements + reuse of the JS engine unchanged | Technically the cheapest native path (§6.9). Rejected by D1. |
| Fully native, logic re-implemented twice (Kotlin + Swift) | — | Double cost and double divergence risk. Replaced by D9 (KMP once). |
| Fully native + embedded JS engine (QuickJS) | Native UI, the published JS logic run headless | Real alternative to D9; see §8.2. |

---

## 5. The reference use case: restaurant

A web-app for the restaurant (back office: menu, tables, kitchen display, reports) and a mobile/tablet app for
waiters to take orders.

### 5.1 What the waiter app needs, mapped to Plitzi primitives

| Need | Plitzi primitive that already exists |
|---|---|
| Order "cart" | State: `appendState`, `removeState`, `toggleInState`, `moveState`, `clearState` |
| Order total, item count | `settings.computed` (e.g. `{{ state.order\|length }}`) |
| Send order to kitchen | `runServerAction` — already accepts **`idempotencyKey`**, so a double tap or retry never duplicates an order |
| Tables, menu, dish status | Queries + `invalidateQueries` |
| Waiter vs admin | The space's user auth, roles shared by both spaces |
| Phone vs tablet layouts | `displayMode` (`desktop` / `tablet` / `mobile`) inside the mobile space |
| Printer, vibration | `hostAction` → native capability |

Screens for the flow: **login (PIN)** → **tables** → **menu** (categories, modifiers) → **order** (quantity, notes) →
**send** → **status**. Elements needed: container, text, image, button, list, tabs, modal / bottom sheet, form fields
(quantity stepper, notes). A small initial catalog.

### 5.2 What this use case demands that does not exist today

1. **Offline** — a local queue of `runServerAction` calls, retried with the same `idempotencyKey`. This is the main
   technical reason to go native rather than an installable web app.
2. **Real-time** — published spaces refresh by polling today (`ApiContainer.refreshSeconds`); server actions stream
   their own progress, but there is no server→client push channel for a published space. Polling every ~5 s is
   acceptable to start; push (FCM / APNs + server events) later.
3. **Shared logic between spaces** — the kitchen (web) and the waiter (mobile) use the same "create order" action
   (§9.5).
4. **Hardware** — Bluetooth/network ticket printers, if requested, through `hostAction`.
5. **Where data lives** — Plitzi does not store orders (collections were removed, RFC 0008). The restaurant needs its
   own backend (its API, Supabase, …) wired through connectors. Say so when selling.

---

## 6. Evidence from the codebase

All figures measured on 2026-09-24 against `plitzi-workspace` at version `0.37.2`.

### 6.1 The schema is element-agnostic data

`packages/sdk-shared/src/types/SchemaTypes.ts`:

```ts
type Element = { id: string; attributes: TAttributes & { subType?: string }; definition: ElementDefinition };

type ElementDefinition = {
  rootId; label; type: string; parentId?; items?: string[];
  styleSelectors: { base: string; [selector: string]: string };
  bindings?: Partial<Record<'attributes' | 'style' | 'initialState', ElementBinding[]>>;
  interactions?: Record<string, ElementInteraction>;
  initialState?: { visibility?: boolean; styleVariant?; styleSelectors?; [key: string]: unknown };
  runtime?: 'server' | 'client' | 'shared';
  loadStrategy?: 'eager' | 'lazy' | 'visible';
};

type ElementBinding = { id; source: string; transformers?: BindingTransformer[]; when?: RuleGroup; enabled?; to: string };

type ElementInteraction = {
  id; title; type: 'trigger' | 'globalCallback' | 'callback' | 'utility' | 'task';
  action: string; params; preview;
  elementId: string | null;     // element id; the source module ('state', 'space') for a globalCallback; null for a utility
  beforeNode: string; afterNode: string; flowId: string; enabled: boolean; when?: RuleGroup;
};

type Schema = { flat: Record<string, Element>; definition; variables; settings; rsc?; pages: string[]; pageFolders };
```

`type` is a string resolved against a catalog. A native catalog can register its own `type` values. The element `id`
is the element's one name (RFC 0013): what `items`, `parentId`, bindings and interactions refer to.

### 6.2 Element declarations are already data-only

`packages/sdk-elements/src/elements/declarations/index.ts` exports every element's declaration **without its React
component**, precisely so it can be read outside a browser. A declaration (`elementDeclaration<Attrs>()({...})`)
carries: `type`, `attributeValues`, `content.attributes` (defaults), `content.definition` (label, description, items,
bindings, `styleSelectors`, `initialState`), `builder` capabilities, `market` metadata, `defaultStyle` and
`settings`. A native catalog can publish declarations of the same shape.

### 6.3 Interactions: global callbacks are platform-neutral

The global callbacks (from `packages/sdk-interactions/src/sources/*/callbacks.ts`):

- **State:** `setState`, `toggleState`, `appendState` (`unique`, `withId`), `removeState` (`by`, `index`),
  `moveState`, `toggleInState`, `clearState`
- **Actions:** `runServerAction` (`actionId`, `input`, `mode`, `idempotencyKey`), `cancelServerAction`
- **Auth:** `login`, `refreshDetails`, `logout`
- **Navigation:** `navigate` (URL-based → maps naturally to deep links)
- **Queries:** `invalidateQueries`
- **Host:** `hostAction` (`action`, `value`)

The flow model: a `trigger` node (e.g. a button's `onClick`) starts a flow; steps are chained by
`beforeNode` / `afterNode` within a `flowId`; each step may have a `when` condition (a `RuleGroup` evaluated by
`QueryBuilderEvaluator` from `@plitzi/plitzi-ui/QueryBuilder`); params are resolved through twig before the step runs
(`InteractionsHelper.tsx`, up to 5 resolution passes, max param depth 5). Element-level callbacks and triggers are
declared by each element.

### 6.4 DOM coupling per package

Files matching `document.` / `window.` / `HTMLElement` / `className` / `querySelector` over non-test source files:

| Package | DOM files / total | Reading |
|---|---|---|
| `sdk-interactions` | 0 / 32 | Portable |
| `sdk-schema` | 0 / 7 | Portable |
| `sdk-event-bridge` | 0 / 6 | Portable |
| `sdk-plugins` | 0 / 4 | Portable (not used on mobile, D4) |
| `sdk-navigation` | 1 / 3 | `useNavigation` reads `window.location` for the hostname; router location is already abstracted |
| `sdk-auth` | 3 / 15 | `SessionStore` (localStorage/sessionStorage + `storage` event), `sessionHint` (`document.cookie`) |
| `sdk-shared` | 20 / 290 | Mostly portable; barrels can drag web code |
| `sdk-variables` | 17 / 27 | Web |
| `sdk-authoring` | 14 / 56 | Node-side; not shipped to devices |
| `sdk-style` | 69 / 188 | **CSS** — not portable |
| `sdk-elements` | 90 / 231 | **DOM** — not used (D5) |
| `sdk-dev-tools` | 84 / 156 | Web |

`@plitzi/nexus` has an agnostic core (`src/react`, `src/next`, `src/vue` adapters).

### 6.5 The style model

`packages/sdk-shared/src/types/StyleTypes.ts`:

```ts
type DisplayMode = 'desktop' | 'tablet' | 'mobile';
type Style = {
  platform: Record<DisplayMode, Record<string, StyleItem>>;   // named "platform", but it means breakpoint
  mode?; theme: { default: Theme; schemes: Theme[] }; variables; fonts?: SpaceFont[];
  cache: string;                                              // compiled CSS — useless on mobile
};
```

- Properties are **CSS, kebab-case** (`'padding-top': '6px'`, `cursor: 'pointer'`), keyed by selector and state
  (`style.base.default`).
- States (`packages/sdk-shared/src/style/styleStates.ts`): `hover`, `focus`, `focus-visible`, `focus-within`,
  `active`, `disabled`, `checked`, `visited`.
- Theme and variables end up as CSS custom properties and `light-dark()` on the web.

What maps to native: box model, flex, colour, typography, borders, radii, shadows; `styleSelectors` behave like named
styles; `active` → pressed, `focus` / `disabled` exist; breakpoints → window size classes. What does not: grid,
cascade, `hover`, `visited`, `focus-visible` semantics, `customCss`.

### 6.6 Web-isms in `Schema.settings`

`customCss`, `stateStorage` / `tokenStorage` (`localStorage` | `sessionStorage`), `sessionHintCookie`,
`sessionExchangeUrl`. On mobile these are ignored or become per-platform settings. Everything else in settings
(`keepState`, `transientState`, `computed`, the user provider URLs and paths, `sessionGate`,
`sessionRevalidateSeconds`) is meaningful on mobile.

### 6.7 The server surface a native client would use

- **Server actions** live on the space's SSR host at `config.action.path ?? '/_action'`
  (`apps/server/src/core/services/action.ts`), published to the web client as `server.ssr.actionPath` and stored in
  `actions.endpoint`. Sub-routes: `GET /_action/catalog` (requires a user), `POST /_action/hook/:id` (signed webhooks),
  `DELETE /_action/run/:runId` (cancel). Progress is streamed; the web client reads it with `fetch` + a reader, never
  `EventSource`.
- **RSC data** at `config.rsc?.path ?? '/_rsc'` — not used on mobile (D3).
- **Analytics ingest** at `${apiServer}/v1/collect`, keyed by the space's `webKey`.
- **The builder's client-side SDK** talks GraphQL with `Authorization: Bearer <webKey>` and an `sdk-version` header
  (`apps/sdk/src/modules/App/AppHelper.ts`).
- **Gap:** there is **no JSON endpoint that serves a published space's schema** to a non-browser client; SSR embeds
  it in the page. A native client needs one (§9.3).
- **Per-space backend logic:** `SpaceAction`, `SpaceConnector`, `SpaceCredential` (`packages/sdk-shared/src/types/SpaceTypes.ts`)
  are owned by a space.
- **Real-time for published spaces:** polling only (`ApiContainer.refreshSeconds`).

### 6.8 Size of the client logic that has to exist on the device

| Piece | Size today (TS, non-test) | Tests today |
|---|---|---|
| Twig interpreter (`sdk-shared/src/helpers/twigWrapper`: Lexer, Parser, AST, Evaluator, filters, TemplateCache) | ~3,800 lines | ~3,200 lines |
| Interactions engine + callbacks + state source (`InteractionsHelper`, `InteractionsManager`, `sources/*/callbacks.ts`, `StateInteractions`) | ~1,400 lines | several suites |
| Flow conditions (`QueryBuilderEvaluator` in `@plitzi/plitzi-ui/QueryBuilder`, `sdk-shared/helpers/ruleEvaluator.ts`) | small | — |
| Renderer + closed catalog + style translator | new, **per platform** | — |

### 6.9 The React Native probe (kept for the record)

Before D1, a probe answered whether the published packages run on a mobile JS runtime:

- Expo SDK **57.0.24**, React Native **0.86.3**, React **19.2.3**; `@plitzi/*` **0.37.2**, `@plitzi/nexus` **1.3.0**,
  `@plitzi/plitzi-ui` **1.6.22**, installed from npm with npm (not Yarn) in a folder outside the workspace globs.
- The app imported `StoreProvider` (`@plitzi/nexus/react`), `InteractionsContextProvider`
  (`@plitzi/sdk-interactions/InteractionsContextProvider`), `StateInteractions`
  (`@plitzi/sdk-interactions/sources/StateSource`) and `processTwig` (`@plitzi/sdk-shared/helpers/twigWrapper`).
- `expo export --platform android` **bundled successfully: 1,637 modules, 3.2 MB Hermes bytecode, ~5.6 s**, with zero
  changes to any package. The packages are ESM-only (`.mjs`, `import` condition) and Metro resolved them.
- One friction: `@plitzi/plitzi-ui` declares `peer react ^19.2.8`, while RN pins React exactly (19.2.3 — the renderer
  refuses any other version). Solved with `legacy-peer-deps` inside the POC folder. If RN is ever revisited, relax
  that peer range.
- Not verified: running on a device (bundling proves resolution and compilation, not runtime behaviour).

This matters even under D1: it proves the logic packages are genuinely platform-neutral, which is what makes the
QuickJS alternative (§8.2) realistic.

---

## 7. What the mobile app is, and is not

**Is:** a native app that downloads a published mobile space (schema + style data), renders it with Plitzi's closed
native catalog, runs its state, bindings and interaction flows on the device, and calls the backend (server actions,
queries, auth) over HTTP.

**Is not:** a browser. No SSR/RSC, no `customCss`, no raw HTML/JSX, no plugins, no custom elements, no arbitrary
code downloaded — **only data**.

---

## 8. Architecture proposal

### 8.1 Layers

```
┌───────────────────────────── Native app (per customer, white-label) ─────────────────────────────┐
│  UI — per platform                                                                                │
│    Android: Jetpack Compose catalog          iOS: SwiftUI catalog                                 │
│    (Container, Text, Heading, Button, Image, List, Tabs, Sheet/Modal, FormControl, …)             │
│    Style resolver: Style.platform data → Compose modifiers / SwiftUI modifiers                   │
├───────────────────────────────────────────────────────────────────────────────────────────────────┤
│  Engine — written once (Kotlin Multiplatform), no UI imports                                      │
│    Schema model (flat map, pages)      Store (state tree, observable)     Twig interpreter        │
│    Bindings resolver                   Interactions engine (flows, when)  computed values         │
│    Adapters (interfaces): SecureStorage · Http · Navigator · Host capabilities · Clock            │
├───────────────────────────────────────────────────────────────────────────────────────────────────┤
│  Platform services                                                                                │
│    Keystore / Keychain · offline action queue · push (FCM / APNs) · deep links · printers        │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
                     │  HTTPS: schema delivery · /_action · queries · auth · /v1/collect
                     ▼
            Plitzi backend (unchanged model; the same one the web-app uses)
```

### 8.2 The engine: Kotlin Multiplatform vs embedded QuickJS

| | **KMP engine (proposed, D9)** | **QuickJS + published JS packages** |
|---|---|---|
| Written | Once in Kotlin, compiled to Android (JVM) and iOS (native) | Zero engine code: runs `@plitzi/sdk-shared` twig + `sdk-interactions` headless |
| Parity with web | Only as good as the conformance suite (D10) | Guaranteed — same code |
| Moving parts | Fewer at runtime | JS engine per platform, bridge for state/events, bundle of the JS packages, React-less headless use of code that today lives in React providers (`StateInteractions` is a component) |
| Debuggability | Native tooling | Two runtimes, bridge boundary |
| Startup / memory | Native | Engine + bundle |
| Risk | Divergence from the web | Bridge complexity; the JS code was not designed to run without React |

Recommendation: **KMP + conformance suite.** Revisit QuickJS if the conformance suite shows the port is diverging
faster than it can be maintained.

### 8.3 Parity: the conformance suite (D10)

Convert the existing JS test cases into **language-neutral JSON fixtures** — `{ template, context, expected }` for
twig; `{ schema, state, event, expectedState, expectedCalls }` for flows — generated from (or alongside) the current
Vitest suites in `sdk-shared/src/helpers/twigWrapper/__tests__` and `sdk-interactions`. Both the JS packages and the
Kotlin engine run the same fixtures in CI. A twig filter or a flow rule that exists on the web and not on mobile then
fails a test instead of failing a customer.

### 8.4 The closed native catalog

Initial set (enough for the restaurant flow): `container`, `text`, `heading`, `paragraph`, `button`, `image`, `list` /
`listItem`, `tabContainer`, `modalContainer` (bottom sheet on mobile), `formControl` (text, number stepper, textarea,
select), `form`.

Anticipate the ones business apps always ask for, because each new element means an app release (store review, slow
user updates): barcode/QR scanner, signature, camera / photo upload, map, charts, date/time picker, pull-to-refresh,
swipe-to-act list rows. Non-visual device capabilities (print, vibrate, share) go through `hostAction` instead, to keep
the visual catalog small.

Each native element publishes a declaration of the same shape as §6.2 so the builder, the MCP and the linter can read
it.

### 8.5 Styles

- Resolve at runtime from **`Style.platform` data**, never from `Style.cache`.
- Support only the subset the catalog's elements use (the translator does not have to understand "any CSS").
- **Tokens are the most valuable shared asset:** theme (`default` + `schemes`, light/dark), variables and fonts. They
  are what makes the customer's web and app look like the same brand.
- `displayMode` (`desktop` / `tablet` / `mobile`) maps to window size classes.
- Everything outside the subset is rejected by the mobile lint profile (§9.2), with the fix in the message.

### 8.6 Navigation

Pages have slugs and `navigate` is URL-based. Map page paths to native screens (stack navigation); the same paths
become deep links (`https://…/table/4` opens the table screen). Route and query params keep the meaning they have on
the web.

### 8.7 Auth and storage

- Tokens in **Keystore (Android) / Keychain (iOS)** behind the engine's `SecureStorage` adapter — the native
  counterpart of `SessionStore`, which on the web uses `localStorage` / `sessionStorage`.
- The space's user provider (`settings.userProvider`, `loginUrl`, `userUrl`, `refreshUrl`, `logoutUrl`, token paths)
  keeps its meaning; cookie-based hints (`sessionHintCookie`) do not apply.
- The desktop app already authenticates with bearer + CSRF instead of cookies; reuse that thinking for the platform
  side. **Verify** at kickoff which auth path a published space's end users take (space user provider vs the Plitzi
  identity) — O4.
- `keepState` → a persistence adapter (DataStore / UserDefaults or a small KV store).

### 8.8 Data, actions and offline

- Queries and server actions over HTTP, same endpoints as the web (§6.7).
- **Offline queue:** `runServerAction` calls are persisted with their `idempotencyKey` and retried until the server
  acknowledges. The UI shows pending / sent. Server-side idempotency already exists; the queue is new.
- Query results cached with a TTL (the web has a staleTime-based cache in nexus; mirror the semantics).

### 8.9 Real-time

Phase 1: polling (`refreshSeconds`). Phase 2: push — FCM / APNs for background notifications, plus a server→client
event channel for foreground updates. Designing that channel for published spaces is platform work that also benefits
the web.

### 8.10 Versioning between the app and the space

The catalog ships in the binary; the schema comes from the server. With a closed catalog this is simple:

- The app sends its **catalog version** (a monotonically increasing integer) when requesting the schema.
- A published mobile space records the **minimum catalog version** it needs (derivable: the highest version that
  introduced any element / callback / style feature the space uses).
- The server (or the app) answers *"update the app"* when the installed catalog is too old.
- The renderer degrades gracefully on an unknown `type` (placeholder, never a crash).
- The publish gate (the linter's `SPACE_INVALID` path) also checks this.

---

## 9. Platform changes outside the app

None of these is required for the first POC (which reads a bundled schema); all of them are required for a product.

| # | Change | Where | Needed for |
|---|---|---|---|
| 9.1 | A space **target**: `web` \| `mobile` | space model, builder, MCP | Knowing which catalog, lint profile and publish path apply |
| 9.2 | A **mobile lint profile** in `sdk-authoring` — rejects or warns (with the fix in the message) on anything outside the catalog, callbacks and style subset | `sdk-authoring` | Builder / MCP offer only what works; nothing silent |
| 9.3 | A **schema delivery endpoint** for native clients: published mobile space as JSON (schema + style data + min catalog version), authenticated by the space key | `apps/server` / `plitzi-sdk-server` | Any real app |
| 9.4 | The **catalog-version handshake** and publish-gate check (§8.10) | server + linter | Any app in users' hands |
| 9.5 | **Shared backend logic across spaces** (below) | data model | Web + mobile for the same customer |
| 9.6 | **Conformance fixtures** exported from the JS tests (§8.3) | `sdk-shared`, `sdk-interactions` | Engine parity |
| 9.7 | Native catalog **declarations** readable by the builder and the MCP | new package or generated JSON | Authoring mobile spaces |
| 9.8 | **Builder preview** of a mobile space | builder | Editing — see O5 |

### 9.5 Shared backend logic — the three options

Actions, connectors and credentials belong to a space today. With D2, the customer's "create order" action would
exist twice and the copies would drift.

1. **The mobile space calls the web space's actions.** The smallest change, but it creates a dependency between spaces
   that has to be authorised and versioned.
2. **Lift actions, connectors and credentials to the workspace**; spaces use them without owning them. Cleanest, and
   consistent with "the account is a workspace" — but a data-model change touching access, change history and
   metering. **Leaning towards this one.**
3. **A backend-only space** (no pages) that both the web and mobile spaces use. A variant of (1) with clearer roles.

---

## 10. Distribution

- **The schema is data, not code.** Downloading UI and interpreted logic from the server is common practice (Expo
  Updates, CodePush-style apps) and acceptable to the stores as long as the app does not change its primary purpose.
  A closed catalog means nothing executable is ever downloaded.
- **Catalog changes require a binary release** (store review, slow adoption) — hence §8.4's anticipation list and
  §8.10's handshake.
- **One binary, configured per customer (white label).** Because no customer contributes code, "Restaurant X" and
  "Clinic Y" are the same program with a different space, icon and name, which can be built automatically. Caveat:
  Apple tends to reject many template-cloned apps published from one account; each customer should publish from
  **their own developer account**. A generic "Plitzi player" app that loads any space would face more review
  friction than a branded app per customer.

---

## 11. POC plan (next session)

### 11.1 Goal

Prove, on the author's **Android** phone, that **a Plitzi schema renders natively and is interactive**: elements from
a closed Compose catalog, styles from `Style.platform`-shaped data, state + twig bindings, and a button flow that
changes state.

What it proves: the schema model and the flow model work natively. What it does **not** prove: reuse of the JS logic —
that is impossible without JS on the device, and is the expensive part of the product.

### 11.2 Toolchain (state of the machine on 2026-09-24)

- Present: **JDK 23** (Homebrew OpenJDK 23.0.1), Node 24, npm 11.
- Absent: **Android SDK, Gradle, `adb`, Kotlin compiler, Xcode** (no `simctl`), Android Studio.
- Needed to build and verify here: Android command-line tools (`brew install --cask android-commandlinetools`, then
  `sdkmanager` for `platform-tools`, a recent `platforms;android-XX` and `build-tools`), several GB outside the repo —
  **ask before installing**. Gradle comes with the project's wrapper. Check the JDK version the chosen Android Gradle
  Plugin supports (JDK 17 or 21 is the safe choice; install alongside JDK 23 if needed).
- Alternative: write the Gradle project and let the author open it in Android Studio — but then compilation cannot be
  verified in-session.
- Deploying to the phone: USB debugging + `adb install`, or copy the APK.

### 11.3 Location and isolation

- Put it at **`mobile/`** at the monorepo root. **Not** under `apps/`: the workspace globs are `apps/*`, `packages/*`,
  `e2e`, `examples/shared-space`, `examples/*/*`, and anything matched is picked up by `yarn install` and turbo. A
  Gradle project has no `package.json`, but staying outside the globs removes the question entirely.
- **Touch nothing outside `mobile/`.** Add a `mobile/.gitignore` (`build/`, `.gradle/`, `local.properties`,
  `*.apk`, …) instead of editing the root one. If the POC fails, `rm -rf mobile/` restores the repo.

### 11.4 Layout

```
mobile/
  settings.gradle.kts, build.gradle.kts, gradle/ (wrapper + version catalog)
  engine/        # pure Kotlin (JVM target for now), NO Android imports — KMP-ready
    schema/      # data classes for Schema / Element / ElementDefinition / ElementInteraction / Style (kotlinx.serialization)
    store/       # state tree + observable (StateFlow), path get/set ("runtime.state.order")
    twig/        # minimal interpreter: {{ path }}, string concat (~), |length, |default — grows with fixtures
    interactions/# flow runner: trigger → beforeNode/afterNode chain; setState/toggleState/appendState/removeState/clearState
    test/        # JUnit + a first set of JSON conformance fixtures
  android/       # Compose app: catalog + style resolver + screen host
    catalog/     # Container, Text, Heading, Button, Image, List
    style/       # Style.platform subset → Modifier / TextStyle
    assets/      # the demo schema JSON
```

### 11.5 Scope in two steps

**Step 1 — hello, native Plitzi.** Bundled schema with a heading, a text bound to state, and a button whose `onClick`
flow runs `toggleState`. Styles: padding, margin, background colour, colour, font size/weight, border radius, flex
direction, gap, alignment.

**Step 2 — the waiter's mini flow.** A list of dishes from state; tapping a dish runs `appendState` on
`state.order`; a text shows `{{ state.order|length }}` items; a "clear" button runs `clearState`. This exercises
lists, bindings, appends and computed-like templates — the core of the restaurant app — still fully offline and
without a backend.

Out of scope for the POC: fetching from the server, auth, server actions, the offline queue, iOS, the builder.

### 11.6 Demo schema (shape to follow)

Faithful to §6.1; verify details (binding `source` naming, the exact trigger name on `button`) against
`sdk-authoring` and a real seed at kickoff.

```json
{
  "pages": ["home"],
  "flat": {
    "home": {
      "id": "home",
      "attributes": { "slug": "" },
      "definition": { "rootId": "home", "label": "Home", "type": "page", "items": ["title", "count", "toggle"],
        "styleSelectors": { "base": "page" } }
    },
    "title": {
      "id": "title",
      "attributes": { "content": "Mesa 4" },
      "definition": { "rootId": "home", "parentId": "home", "label": "Title", "type": "heading",
        "styleSelectors": { "base": "title" } }
    },
    "count": {
      "id": "count",
      "attributes": { "content": "Items: {{ state.order|length }}" },
      "definition": { "rootId": "home", "parentId": "home", "label": "Count", "type": "text",
        "styleSelectors": { "base": "muted" } }
    },
    "toggle": {
      "id": "toggle",
      "attributes": { "content": "Add dish" },
      "definition": {
        "rootId": "home", "parentId": "home", "label": "Add", "type": "button",
        "styleSelectors": { "base": "primary-button" },
        "interactions": {
          "trig": { "id": "trig", "title": "Click", "type": "trigger", "action": "onClick", "params": {}, "preview": {},
            "elementId": "toggle", "beforeNode": "", "afterNode": "add", "flowId": "f1", "enabled": true },
          "add": { "id": "add", "title": "Append", "type": "globalCallback", "action": "appendState",
            "params": { "key": "order", "value": "Paella" }, "preview": {},
            "elementId": "state", "beforeNode": "trig", "afterNode": "", "flowId": "f1", "enabled": true }
        }
      }
    }
  },
  "style": {
    "platform": {
      "mobile": {
        "primary-button": { "style": { "base": { "default": {
          "background-color": "#4422ee", "color": "#ffffff", "padding-top": "12px", "padding-bottom": "12px",
          "border-top-left-radius": "8px", "border-top-right-radius": "8px",
          "border-bottom-left-radius": "8px", "border-bottom-right-radius": "8px" } } } }
      }
    }
  }
}
```

### 11.7 Done when

- The APK installs and runs on the author's Android phone.
- Step 1 and Step 2 behave as described; state changes re-render only what is bound.
- `engine/` has no Android imports and its JUnit tests (including the first JSON fixtures) pass.
- `git status` in the monorepo shows only `mobile/`.

---

## 12. Roadmap after the POC

1. **Engine hardening:** full twig parity driven by the conformance suite (9.6); flow `when` conditions; every global
   callback in §6.3.
2. **Server integration:** schema delivery endpoint (9.3), auth (8.7), server actions + offline queue (8.8), queries
   with cache.
3. **Real restaurant flow** (D8) end to end, with a real customer if possible.
4. **Platform:** space target (9.1), mobile lint profile (9.2), catalog declarations (9.7), versioning handshake
   (9.4), shared backend logic (9.5).
5. **iOS:** move `engine/` to a KMP module, SwiftUI catalog.
6. **Real-time and push** (8.9); host capabilities (printers, scanner).
7. **Builder preview** (9.8) and **white-label build pipeline** (§10).

---

## 13. Open questions

| # | Question | Notes |
|---|---|---|
| O1 | Why was React Native rejected? | If the reason is "it must be truly native", RN already renders native components (not a WebView) — the probe (§6.9) showed it is by far the cheapest path. If the reason is another (performance, team skills, dependency risk, long-term control), record it here; it strengthens D1. |
| O2 | KMP engine or QuickJS? | Proposed KMP (§8.2). Decide before Step 2 of the roadmap. |
| O3 | Which option for shared backend logic (§9.5)? | Leaning (2), workspace-level. |
| O4 | Which auth do a published space's end users use on mobile — the space's user provider, or the Plitzi identity? | Verify in `sdk-auth` / `apps/server` before designing §8.7 in detail. |
| O5 | How does the builder preview a native space? | Options: an approximate web rendering of the native catalog in the canvas; a companion app on a device live-connected to the builder; both. |
| O6 | Style subset: exact property list for v1. | Start from what the catalog elements need; grow with the lint profile. |
| O7 | Pricing / packaging of mobile apps (per app, per customer, per build). | Business decision. |
| O8 | Minimum OS versions (Android API level, iOS version). | Decide with the first customer. |

---

## 14. Kickoff checklist for the next session

1. Read §3 (Decisions) and §13 (Open questions); ask the author about **O1** if still unrecorded.
2. Confirm permission to install the Android command-line tools (§11.2), or agree on the Android Studio route.
3. Create `mobile/` at the repo root (§11.3) with its own `.gitignore`; touch nothing else.
4. Verify the demo schema shape (§11.6) against `sdk-authoring` and a seed; adjust the JSON, not the model.
5. Build `engine/` first, with tests; then the Compose catalog; then Step 1, then Step 2 (§11.5).
6. Install on the author's Android phone and walk through §11.7.
7. Update this RFC with what the POC learned (evidence, decisions, answered open questions).
