# RFC 0021 — Components replace segments

- **Status:** Implemented — the guide is `docs/en/components.md`; delete this file once it is committed. Phase 3 (the
  workspace library) is recorded there as left open.
- **Author:** Carlos Rodriguez
- **Date:** 2026-10-01
- **Scope:** `@plitzi/sdk-shared`, `@plitzi/sdk-schema`, `@plitzi/sdk-elements`, `@plitzi/sdk-authoring`,
  `@plitzi/sdk-server` (`apps/server`), `apps/builder`, `apps/sdk`; `plitzi-sdk-server` (GraphQL, Mongo, SSR,
  templates, seeds, MCP); a follow-up RFC for the workspace library

---

## 0. As implemented — what changed from the proposal below

- **Props are attributes of the instance**, not a `props` object on it: attribute templates and bindings only reach
  top-level attributes, so this is what lets both hand a prop in with no mechanism of their own.
- **Four declaration mutations, not three**: `SpaceDetachInstance` joined them. A detach mints the copy's names
  deterministically (`uniqueElementId` against the document), so every side applies the same call and arrives at the
  same names, as one undo step.
- **No `componentId` argument anywhere**: ids are one namespace, so `flatMapOf` resolves the tree from the id (rule 2).
- **Slots**: each child names its slot in `attributes.slot` (as a page names its `layoutContainer`); `ElementLayout`
  went from `containerId` to `slots`, shared by layouts and components. `referenceContainer` was only ever settable for
  segments and went with them.
- **Builder**: the open component is a scope keyed by the component over the whole builder (`useOpenComponent`) —
  keyed, because a scope applies a new value after the render that hands it over, and the canvas resolves its root
  during it.
- **MCP**: `upsertComponent` and `deleteComponent`; element ops work inside a component through `pageRef` on a view of
  the space; detaching is the builder's alone (the op union is carried on every request). Tool listing budget 195k.
- **Also gone with segments**: the public `Segment`/`Segments` queries' NoSQL filter (`sanityFilter`, no other user),
  `Space.cloneElement` (no caller), `CommonState.prevSchema`, `BuilderPopup`, `useDragElement`'s `onParentRefresh`.
- **Phase 0**, measured on the local database: one segment, placed by no page. The cluster is to be measured before
  release; no migration script was written.

## 1. Summary

A **segment** today is a subtree of elements with its own style and variables, kept in a Mongo collection of its
own, edited in a builder mode of its own through twenty mutations that mirror the space's, published per environment
on its own, and dropped into a page through a `reference` element.

This RFC removes segments and introduces **components**: a reusable subtree that lives **inside the space document**,
in `schema.components` — each component with a `flat` of its own, beside the space's `schema.flat` and never inside
it — styled in the space's own `Style` document, declaring **props** and **slots**, and placed on a page as an
**instance**. Because a component is part of the space, it is versioned, published, rolled back, copied by templates
and exported by `plitzi create --from` with no code of its own to make that happen, and every tool that already reads
a space — the linter, `sdk-authoring`, the MCP tools, the change history — reads it.

Sharing components **between** spaces is a separate concern, sketched in §6 and left to a follow-up RFC: a workspace
library that is **copied with a pinned revision**, never linked live.

### 1.1 Simplification is a goal, not a side effect

This RFC is also meant to make Plitzi smaller. Removing segments deletes about **5,100 lines** of code dedicated to
them — 2,377 in `plitzi-sdk-server` (the model and 32 GraphQL files), 977 in `sdk-shared` (29 GraphQL documents, the
types, the context), 1,730 in the builder's and the SDK's `Segments` modules, 470 of seeds — plus **96 published
subpaths**, 21 live events, a Redis key, a Mongo collection, a builder mode and a React context. Components are only
worth adding if they do not grow a stack like that back. So every part of §4 is held to these rules, and a change
that breaks one needs saying why in its PR:

1. **No parallel family.** No `Component*` element mutations, no component events beside the element events, no
   `ComponentsContext`, no reducer of its own. Components live in `schema`, so the schema's store, reducer, events
   and mutations carry them.
2. **No signature change to what exists.** Ids are one namespace (RFC 0013), so an id already says which tree it is
   in: the existing element mutations and events keep their arguments, and the tree is resolved from the id (§4.5).
3. **No new element type, no second style document, no CSS to concatenate.** A component's root is an ordinary
   element; its rules are in the space's `Style`.
4. **Reuse before adding.** Props are `ParamSpec`; per-instance state is the list row's `ReplicaProvider` +
   `StoreProvider`; a slot is the mechanism a layout already slots a page with (`plitziElementLayout.containerId`);
   a component's tree is checked by the fragment rule segments already have (`baseElementId`); the library (§6)
   builds on the element-template manifest.
5. **One home per fact.** The declaration lives in `schema.components[id]`, nowhere else: no list of components
   beside it, no copy of the props on the instance's element, no index stored that can be derived.
6. **Delete first.** Removing segments ships before components are built (§10), so components are written against a
   codebase with one model fewer and no compatibility layer between the two. The one exception is data: if Phase 0
   finds segments that pages actually place, components come first so the migration (§8) has somewhere to put them —
   and removal follows in the same release, never as a later clean-up.

## 2. What exists today

**Storage.** `plitzi-sdk-server/src/services/mongo/models/Segment.ts` — collection `segment`, one document per segment
per environment per publish:

```ts
{ spaceId, identifier, environment, definition: { name, description, baseElementId },
  schema: { flat, variables }, style: Style, snapshot? }
```

`identifier` is `${appEnvironment}_${snakeCase(name)}_${random8}` (`SegmentAddMutation`). A segment belongs to one
space (`spaceId`); there is no cross-space reuse.

**Server API.** Twenty mutations under `src/services/graphql/schema/mutations/segment/**` (add, update, remove,
publish, addTemplate; seven element mutations; three schema-variable mutations; nine style mutations), two queries
(`Segment`, `Segments`), five types, the `segments` field of `SpaceType` (resolved from the `reference` elements the
schema holds), a Redis key (`graphqlSpaceSegmentsKey`) and 21 `SEGMENT_*` space events on the single live channel.
`Segments` answers the public render token, so every published site can query it.

**Rendering.** `getOfflineData` (SSR) aggregates the newest published document of each segment per environment; the
SDK (`apps/sdk`) and the builder concatenate every segment's `style.cache` after the space's; `Reference`
(`packages/sdk-elements/src/elements/advanced/Reference`) renders `referenceType: 'segment'` by fetching the segment
through `SegmentsContext` when the store does not already hold it.

**Builder.** `apps/builder/src/modules/Segments/**` (panel, reducer, context provider, form), a `mode: 'segment'` of
the builder (`BuilderPopup` with `segmentIdentifier`), "Save as segment" in the overlay and the context menu, and the
segments reducer threaded through `Queue` and `Undoable`.

## 3. Why segments are not kept

1. **They break the version model.** A snapshot freezes the schema, the style, the plugins, the actions, the
   functions and the runtime — but not the segments, which "are published on their own" (`docs/en/history.md`,
   `projects-from-spaces.md`, the builder's `VersionContents`). The SSR renders the newest published segment for the
   environment, whatever revision of the space is live. So revision 3 of production cannot be reproduced, a rollback
   does not roll segments back, and `plitzi create --from … --revision 3` comes out without them.
2. **Templates leave them behind.** `src/services/templates/copy.ts` copies no segments, and the template panel
   counts them as "left behind". A template that uses one starts a space that shows "Segment not found".
3. **They do not give the one thing nothing else gives.** They are per space, so they offer no cross-space reuse.
   Inside a space, layouts (shared shells), `reference` with `referenceType: 'element'`, element templates and plugins
   already cover the ground — the one segment in the seeds is literally a "Layout Sidebar Footer".
4. **Agents cannot see them.** `sdk-authoring` has no segment concept, the linter (`lintSpace`) does not read them, and
   the MCP co-worker has no tool for them. Authoring by code and by agents is the path Plitzi is betting on; a concept
   that path cannot reach is a concept that will not be used.
5. **They take no parameters.** A segment is a static stamp: no props, no slots. A reusable block that cannot be
   configured is worth little.
6. **They cost a parallel stack.** Twenty mutations that mirror the space's and differ from them in model, lookup,
   event and audit (only `SegmentPublishMutation` writes `space_log`); a second style document merged at render time; a
   second editing mode; an aggregation per environment in the SSR; 96 published subpaths of `@plitzi/sdk-shared`.
7. **Nobody uses them.** No seed places a segment; the one stored by the website seed is referenced by no page.

## 4. Proposal: components inside the space

### 4.1 Where a component lives

**`schema.flat` is the tree of the pages.** Every element in it is reachable from a page — a layout too, because a
layout is part of a page's chain: the page names it and renders inside it. A component is part of no page; its tree
goes elsewhere, so `flat` keeps holding only what a page renders:

```ts
type Schema = {
  flat: Record<string, Element>;           // the pages, their layouts and nothing else — unchanged
  pages: Element['id'][];
  components: Record<ComponentId, Component>;
  // …
};

type Component = {
  id: ComponentId;                         // the key it is stored under, and what an instance names
  label?: string;
  folder?: string;                         // the page folder the builder files it under; routes nothing
  props?: ParamSpec;
  slots?: Element['id'][];                 // elements of `flat` below that an instance fills
  rootId: Element['id'];
  flat: Record<string, Element>;           // its own tree: `rootId` with `parentId: null`, everything else under it
};
```

| Part | Where |
|---|---|
| The tree | `schema.components[id].flat`, rooted at `rootId` |
| The declaration | `schema.components[id]` itself: `props`, `slots`, `label`, `folder` |
| Its style | The space's `Style` document, as any element's: its selectors and its classes |
| Its variables | `schema.variables` |

Each component owns its `flat`, rather than all of them sharing one `schema.componentsFlat`, because a component is
the unit everything acts on: deleting, copying, exporting or importing one is one key, a component's tree is
validated as a fragment from its own root (the rule the integrity guard already applies to a segment through
`baseElementId`), and `FlatMap` operates on it as it does on a segment's `flat` today. It is also the shape a segment
already has — `definition.baseElementId` → `rootId`, `schema.flat` → `flat` — which makes the migration (§8) a move,
not a transformation.

The root is an **ordinary element** (a container, a card…): the component is declared by its entry in
`schema.components`, not by a new element type, so `sdk-elements` gains no `component` element.

Ids stay **one namespace for the whole space** (RFC 0013): an id inside a component is unique across `schema.flat`
and every component's `flat`, so a selector, a history entry or an error names one element without saying which
tree it is in. The validator checks that across trees.

### 4.2 Props and slots

A component declares its props with `ParamSpec` (`@plitzi/sdk-shared/authoring/paramSpec`) — the vocabulary global
callbacks, element callbacks, utilities and binding transformers already share — so the builder draws the controls,
the linter validates the values and an MCP tool describes them with code that exists:

```ts
components: {
  'product-card': {
    id: 'product-card',
    props: { title: { type: 'text', description: 'Card heading', required: true }, item: { type: 'json', … } },
    slots: ['product-card-actions'],
    rootId: 'product-card-root',
    flat: { 'product-card-root': { … }, 'product-card-actions': { … } }
  }
}
```

Inside the component, bindings read a new source, **`props`**: `{{ props.title }}`. It is a source like any other
(`templateRoots` names it, the binding subscribes to it), so nothing about how bindings work changes.

A **slot** is an element inside the component that an instance fills with children. A component may declare several.
The content names the slot it goes into, as a page already names the container of its layout (`layoutContainer`):
each direct child of an instance carries `attributes.slot`, and with a single declared slot it may omit it. The
renderer is the one layouts use — `plitziElementLayout.containerId`, and `useInternalItems` putting the body where
`isSlot` holds — generalised from one container to the declared slots, so layouts and components slot content
through the same code instead of two.

### 4.3 Instances

An instance is the existing `reference` element with `referenceType: 'component'` (replacing `'segment'`):

```ts
{ type: 'reference', attributes: { referenceType: 'component', referenceId: 'product-card',
  props: { title: '{{ item.name }}', item: '{{ item }}' } } }
```

- `referenceId` is a key of `schema.components`; the instance renders that entry's `flat` from its `rootId`. Nothing
  is fetched: the components arrive with the schema, so the SSR, the SDK and the builder have no segment-style
  lookup or CSS to concatenate.
- Prop values are evaluated **in the instance's scope** — where the instance sits — and handed in. That is how a list
  row passes its record to a card.
- Each instance renders under a `ReplicaProvider` and a scoped `StoreProvider`, exactly as a list row does
  (`ListControlledItem`), so the same interior ids keep isolated element state per instance. (Nexus's `segment` prop
  on `StoreProvider` is unrelated and stays.)
- The children of the instance fill the component's slots (§4.2).
- `referenceType: 'element'` stays as it is, `referenceContainer` included; `referenceContainer` means nothing on a
  component instance, whose slots are declared by the component.
- **Nested components** are allowed: a component's tree may hold instances of others. The validator refuses a cycle
  (a component that reaches itself through its instances), naming the chain.

### 4.4 Scope: closed

The interior of a component sees **`props` and the global sources** (`theme`, `navigation`, `auth`, `runtime.state`,
…) — not the data sources around the instance. Whatever it needs from there comes in as a prop. The separate tree
makes this the natural reading rather than a rule to enforce: `renderContext` walking up from an interior element
reaches the component's `rootId` and has nowhere further to go.

This is what makes a component lintable on its own: `lintSpace` checks its bindings against what it declares, with no
need to know where it will be placed, and an agent authoring it gets every error from one call. It is also what keeps
a component portable to another space (§6).

### 4.5 What comes for free

Because the component is part of `schema` and `Style`:

- **Snapshots, publish, rollback** — included, with no code.
- **Templates** (`templates/copy.ts`) and **`plitzi create --from` / `pull`** — included.
- **Change history** — records it, attributed, like any element (today segments are explicitly not recorded).
- **Integrity guard** — `Space.save()` validates `schema.flat` as today and each component's `flat` as a fragment
  from its `rootId`: the `baseElementId` branch the validator has for segments becomes the component rule, and
  `segmentSchema` goes.
- **Live collaboration** — the space's element events, unchanged; no `SEGMENT_*` events.
- **Element mutations** — `SpaceAddElement`, `SpaceUpdateElement`, `SpaceMoveElement`, … keep their arguments.

The last two hold because **an id says which tree it is in** (rule 2). `FlatMap` resolves an element in `schema.flat`
or in the component whose `flat` holds it; adding names its parent (`to`), and the parent names the tree. The index
from id to tree is derived when the schema is loaded, never stored. A move between two trees is refused — taking a
subtree into a component and back out are their own operations. The resolver is one function in `sdk-schema`, used
by the server's `Space` model and the builder's schema reducer alike, so the server and every client apply an event to
the same tree.

What is new is the declaration, and it takes three mutations, not twenty: `SpaceAddComponent` (empty, or from a
subtree of `flat`, leaving an instance where it was), `SpaceUpdateComponent` (label, folder, props, slots) and
`SpaceRemoveComponent` (refused while instances remain, naming them). Each writes `space_log` like its siblings, so
the asymmetric audit segments had does not come back.

### 4.6 Authoring

`SpaceSpec` gains `components: ComponentSpec[]`, a sibling of `layouts`, written to `schema.components`:

```ts
interface ComponentSpec {
  id: string;
  label?: string;
  folder?: string;
  props?: ParamSpec;
  slots?: string[];
  /** The tree, and its root is what an instance renders — as `TemplateSpec.root`. */
  root: ElementSpec;
}
```

and an instance helper, `component('product-card', { props: { … }, children: { actions: [...] } })`, which refuses at
authoring time a missing required prop, an unknown prop, a value of the wrong type, a slot the component does not
declare and a component that does not exist — with the fix in the message (see the defensive-authoring rule).
`specFromSpace` exports components and instances, and the strict round-trip suite covers them.

### 4.7 Builder

- A **Components** panel replaces **Segments**: list, create, rename, delete, and "Find instances".
- A component is opened **in the normal canvas as its own root**, the way a page is: what the canvas shows becomes
  a page id or a component id, and every editing tool works unchanged because the mutations it sends name elements,
  and elements name their tree. There is no separate builder mode: `mode: 'segment'` and `BuilderPopup`'s
  `segmentIdentifier` go, and `BuilderContext['mode']` is left with `'normal' | 'template'`.
- **"Save as component"** replaces "Save as segment": it moves the selected subtree out of `flat` into a new
  `schema.components` entry and leaves an instance where it was, in one undoable step (`SpaceAddComponent`).
- The instance's settings panel draws the props from `ParamSpec`, and offers "Detach" (replace the instance by a copy
  of the interior, with fresh ids).

### 4.8 MCP and the co-worker

Tools to declare a component (or turn a subtree into one), to place an instance with props, and to list a component's
instances. They go through `sdk-authoring` and the existing element mutations, not through a store of their own.

## 5. Impacted parts

### 5.1 `plitzi-sdk-server`

| Path | Change |
|---|---|
| `src/services/mongo/models/Segment.ts` | Delete |
| `src/services/mongo/models/Space/Space.test.ts` | Drop the "Segment model" block |
| `src/services/graphql/schema/mutations/segment/**` (20 files + `SegmentAddMutation.test.ts`) | Delete |
| `src/services/graphql/schema/queries/segment/**` | Delete |
| `src/services/graphql/schema/types/segment/**`, `types/lists/SegmentListType.ts` | Delete |
| `src/services/graphql/schema/index.ts` | Unregister the above |
| `src/services/graphql/schema/args.ts` | Remove `contextIdArg` — only the segment mutations use it |
| `src/services/graphql/schema/types/space/SpaceType.ts` | Remove the `segments` field; `schema.components` travels inside `schema` |
| `src/services/graphql/schema/mutations/space/elements/**` | Unchanged arguments; the tree is resolved from the id through `Space`'s `FlatMap` (§4.5) |
| `src/services/graphql/schema/mutations/space/` | New `SpaceAddComponent`, `SpaceUpdateComponent`, `SpaceRemoveComponent`, each writing `SpaceLog` like its siblings |
| `src/services/mongo/models/Space/Space.ts` | `FlatMap` per tree: `schema.flat` and each `schema.components[id].flat`; integrity of each component from its `rootId` |
| `src/services/history/**` | Entries for components and for elements inside them (§4.5) |
| `src/services/graphql/schema/subscriptions/SpaceEventSubscription.ts` | Comment: segments out of the channel |
| `src/services/graphql/helpers/sanityFilter/filters/filterMongoDB.ts` (+ test) | Comment names `Segments` as the public-token reader; update |
| `src/services/redis/cacheKeys.ts` | Remove `graphqlSpaceSegmentsKey` and the `'segments'` kind |
| `src/services/ssr/helpers/getOfflineData.ts` | Drop the segment aggregation and `offlineData.segments` |
| `src/services/templates/snapshots.ts` | Drop the segment count from "left behind" |
| `src/services/templates/copy.ts` | Comment |
| `src/services/validation/integrity.ts` | `segmentSchema` becomes the per-component fragment check, driven from `Space` |
| `src/services/mcp/tools/flagIrrelevantTool.ts` | "segments" → "components" in the description |
| `src/services/mcp/tools/**` | New component tools (§4.8) |
| `src/services/ai/README.md` | The segment tools it documents do not exist in code; remove the section |
| `scripts/migrate-segments.ts` + `migrate:segments` script | New, one-off (§8) — beside `migrate:fonts` |
| `docs/space-events.md`, `docs/space-issues.md`, `docs/templates.md` | Remove segments; `space-issues.md` §"Segments are not gated" goes |
| `prisma/README.md` | "space/style/segment documents" → "space/style" |

### 5.2 `plitzi-workspace` — packages

| Path | Change |
|---|---|
| `sdk-shared/src/types/SegmentTypes.ts` | Delete; add `Component` (§4.1) and `Schema.components` / `SchemaRaw.components` |
| `sdk-shared/src/types/{StoreTypes,SdkTypes,SchemaTypes,ElementTypes,EventBridgeTypes}.ts` | Drop `segments`, `'segment'` from `ElementLayoutType` and `EventBridgeModule`; `definition.rootId` comment |
| `sdk-shared/src/schema/schemaConstants.ts` | Comment |
| `sdk-shared/src/segments/**` | Delete `SegmentsContext` |
| `sdk-shared/src/hooks/usePlitziServiceContext.tsx`, `builder/contexts/BuilderContext.ts` | Drop `SegmentsContext`, `mode: 'segment'` |
| `sdk-shared/src/network/NetworkInternalContext.ts` | Drop `segments` |
| `sdk-shared/src/network/graphql/{builder,sdk}/Queries/Segment/**`, both `InitQuery.ts` | Delete; drop `segments` from the init queries |
| `sdk-shared/src/network/graphql/builder/Mutations/Segment/**` + `Mutations/index.ts` | Delete |
| `sdk-shared/src/network/spaceEvents.ts` (+ test) | Remove the 21 `SEGMENT_*` events and `segmentScope`; the element events stay as they are; three events for the declaration (add/update/remove component) |
| `sdk-shared/src/network/graphql/builder/Mutations/Space/**` | The three component mutations; the element mutations are untouched |
| `sdk-shared/package.json` | 96 generated subpaths go (breaking, see §9) |
| `sdk-shared/src/helpers/twigWrapper/templateRoots.ts` | `props` as a root |
| `sdk-schema/src/helpers/schemaValidator.ts` | Validate each `schema.components[id].flat` as a fragment from `rootId` (the `baseElementId` path); ids unique across all trees; slots exist; instances name an existing component; no component cycles |
| `sdk-schema/src/helpers/elementTree.ts` | The one resolver from an id to its tree, shared by the server and the builder (§4.5) |
| `sdk-schema` `FlatMap` | "Move subtree to a component" and "detach instance" (copy back with fresh ids) |
| `sdk-elements/src/elements/advanced/Reference/{Reference,Settings}.tsx` | `'component'` replaces `'segment'`; renders from `schema.components`; props, slots, replica scope |
| `sdk-authoring/src/schema/{types,space}.ts`, `elements/attributeNames.ts`, decompile | `ComponentSpec`, `component()`, export, lint rules |
| `sdk-authoring` lint (`lintSpace`) | Props/slots/scope rules (§4.4) |

### 5.3 `plitzi-workspace` — apps

| Path | Change |
|---|---|
| `apps/builder/src/modules/Segments/**` | Delete; new `modules/Components` |
| `apps/builder/src/modules/App/{AppProvider,helpers/utils}.tsx` | Provider and panel swap |
| `apps/builder/src/modules/App/AppContainer/containers/ContainerDefault.tsx` | Stop concatenating segment CSS |
| `apps/builder` schema reducer and canvas | `schema.components` in the schema store; the reducer resolves an element's tree with the `sdk-schema` resolver; the canvas shows a page or a component |
| `apps/builder/src/modules/App/components/VersionContents/VersionContents.tsx` | Drop the "published on their own" note |
| `apps/builder/src/modules/Builder/{BuilderPopup,BuilderProvider}.tsx` | Remove `mode: 'segment'`, `segmentIdentifier` |
| `apps/builder/src/modules/Builder/components/{BuilderArea,BuilderAreaPreview,BuilderElementTools/ElementSettings}.tsx` | Drop `SegmentsContext` |
| `apps/builder/src/modules/Builder/components/{BuilderContextMenu,BuilderOverlay/OverlayButtonContainer}.tsx` | "Save as component" |
| `apps/builder/src/modules/Network/NetworkContextProvider.tsx` | Drop `Space.segments` |
| `apps/builder/src/modules/{Queue,Undoable}/**` | Drop the segments reducer from the action unions and the queue manager |
| `apps/builder/src/modules/Elements/hooks/useDragElement.ts` | `onParentRefresh(identifier, segment)` signature |
| `apps/sdk/src/modules/Segments/SegmentsContextProvider.tsx` | Delete |
| `apps/sdk/src/{App.tsx,modules/App/AppMain.tsx,modules/Sdk/Sdk.tsx}` | Drop provider, `segments: {}`, segment CSS |
| `apps/server/src/adapters/cloudAdapters.ts` (+ test), `apps/server/README.md` | Drop `segments` from the query and `OfflineDataRaw` (breaking, §9) |

### 5.4 Docs

| Path | Change |
|---|---|
| `docs/en/history.md` | Components are recorded; remove "segments" from "Not recorded" |
| `docs/en/projects-from-spaces.md` | Remove the segments exception |
| New `docs/en/components.md` (and `docs/es`) | The guide this RFC becomes once shipped |

Not affected — the word appears with another meaning: path/route segments (`matchPath`, `slug`, `fonts/upload`,
functions manifest, connectors projection, realtime topics, query cache, `useElementDataSource`), chart and bar
segments (`TrafficChart`, workspace analytics, `UsageBar`/`Ring`), CSS segments (`decompile/customCss.ts`), the
FunctionsEditor breadcrumb, `BorderRadius`, and nexus's `segment` prop.

## 6. Between spaces: the workspace library (follow-up RFC)

Not part of this RFC's implementation; recorded so §4 does not close the door on it.

- A library is **a space of the workspace** whose components are offered to others. Who can see it reuses the
  template visibility (RFC 0016: user / workspace / public).
- **Importing copies** the component — tree, classes, element defaults, variables — into the target space, with
  `source: { spaceId, revision, componentId }` on its `schema.components` entry. The element-template manifest (`TemplateSpec` /
  `authorTemplate`) already carries a subtree **with the style it reads**; it is the format to build on.
- **Updating is explicit**: the builder notices a newer revision of the source and offers it, showing the diff. There
  is no live link, so a space's revision stays reproducible.
- This only works because components are closed (§4.4): a component that read its surroundings could not be copied
  to a space that has other surroundings.

## 7. Seeds impacted

| Path | Change |
|---|---|
| `prisma/seeds/spaces/platform/website/segments.json`, `segments.ts` | Delete — the one segment, "Layout Sidebar Footer", is referenced by no page |
| `prisma/seeds/spaces/platform/index.ts`, `prisma/seeds/spaces/index.ts` | Drop `plitziWebsiteSegments` |
| `prisma/seeds/spaces/seeder.ts` | Drop `SegmentJson`, `MongoSource.segments`, `Segment.removeAll`, the insert loop |
| `prisma/seeds/spaces/platform/website/templates.ts` | `leavesBehind.segments` and the "does NOT get segments" / "Left behind … segments" copy |
| `prisma/seeds/spaces/platform/website/pages/docs-concepts.ts` | Remove "and its segments, which are published on their own" |
| `prisma/seeds/data/logs.ts`, `website/logKind.ts` | `publish-segment` log line and its comment |
| New: one demo using components | A seed where a component is placed several times with different props and a slot (e.g. a card in a list in `field-guide`), so the e2e and visual suites exercise instances |

The landing's `segmented` controls, `an-segmented`, `auth-progress-segment`, `hm-auto-segment`, the seismic and
pizarra plugins are unrelated and unchanged.

## 8. Migration of existing data

`yarn migrate:segments` (`scripts/migrate-segments.ts`), one-off, `--dry-run` by default:

1. For each space, read its `main` segments and the `reference` elements with `referenceType: 'segment'` in every
   environment's documents.
2. **Report** first: segments per space, instances per segment, segments with no instance.
3. With `--apply`, for each segment **that has an instance**: write it to the space's `main` schema as
   `schema.components[id]` — `definition.baseElementId` → `rootId`, `schema.flat` → `flat`, `definition.name` →
   `label`, with ids re-minted where they collide with the space's (RFC 0013) — merge its style into the space's
   `Style`, its variables into `schema.variables`, and rewrite the instances to `referenceType: 'component'` with
   `referenceId` = the new key. Published revisions
   are not rewritten: they are copies, and a segment they rendered was never part of them.
4. Segments with no instance are dropped. The collection `segment` is dropped once every environment has run.

If Phase 0 finds no instance anywhere, the script is not written: segments are removed (Phase 1) with nothing to
move.

## 9. Published API and release

Breaking, and stated as such in the single release changeset (`.changeset/release.md`; the fixed `@plitzi/*` group
moves together):

- `@plitzi/sdk-shared`: the `segments/*` export, `Segment*` types, the segment GraphQL documents and their 96
  subpaths, `SEGMENT_*` events.
- `@plitzi/sdk-server`: `segments` leaves `OfflineDataRaw` and the cloud adapter's query.
- GraphQL: the `Segment*` mutations, `Segment`/`Segments` queries and `Space.segments`.

Plitzi is pre-release: no shims, no deprecation period.

## 10. Plan

| Phase | What | Done when |
|---|---|---|
| **0 — Measure** | One read per environment of the cluster's Mongo: segments per space, `reference` elements with `referenceType: 'segment'` | Numbers in this RFC; decides whether §8 exists |
| **1 — Remove segments** | §5 deletions in both repos; seeds (§7); docs (§5.4); changeset (§9) | No `Segment` symbol left outside CHANGELOGs (`Reference` keeps only `'element'` until Phase 2); seeds reseeded; e2e green; `segment` collection dropped |
| **2 — Components** | sdk-shared types (`Schema.components`); sdk-schema resolver, validator (fragments, cycles, slots), FlatMap ops; the three component mutations and events; `Reference` instances (replica scope, props, slots, nesting); the slot renderer generalised from layouts; `props` source; `sdk-authoring` `ComponentSpec` + `component()` + export + lint; builder Components panel, "Save as component", "Detach", "Find instances"; MCP tools; the components demo seed | Unit tests per package; authoring round-trip strict; e2e: instances with different props render and keep separate state, slots filled, a nested component, a cycle refused; visual suite; `yarn typecheck` + `yarn lint` in both repos; the §1.1 rules hold |
| **3 — Workspace library** | Follow-up RFC (§6) | — |

Phase 1 is deletion only, and it settles the open question about the segment mutations' audit by removing them. If
Phase 0 finds segments in use, Phases 1 and 2 swap and `migrate:segments` runs between them, in one release (§1.1,
rule 6).

## 11. Alternatives considered

- **Keep segments, freeze them into the snapshot.** Fixes §3.1 only; leaves the parallel stack, the missing
  parameters, the invisibility to authoring and the per-space limit.
- **Components as parentless roots of `schema.flat`**, the way layouts are. Rejected: `flat` is the tree of the
  pages, and a layout belongs in it because it is part of a page's chain — the page names it and renders inside it.
  A component is part of no page, and putting it there would fill `flat` with trees no page renders, which every
  reader of `flat` (the validator's orphan walk, the builder's tree, the export) would then have to tell apart. The
  separate home costs no argument on any mutation, because ids are one namespace (§4.5).
- **One shared `schema.componentsFlat` for every component's elements.** Rejected for a `flat` per component: a
  component is the unit that is created, copied, exported, imported and deleted, and with a shared map each of those
  becomes a walk to find which elements are its.
- **Use layouts for everything.** A layout is a shell a page renders inside, one per page chain; it has no props and
  cannot be placed several times on one page.
- **Plugins only.** Right for components written in code, wrong for the builder's and the agents' visual authoring.
- **Live-linked cross-space components.** Rejected for §6: a live link makes a revision depend on another space's
  state, which is the defect §3.1 describes.

## 12. Open questions

1. **Outward events.** Should a component declare callbacks an instance can bind flows to (`onSelect`), the way
   elements declare triggers? Not needed for v1 — a component can write `runtime.state` — but the declaration should
   leave room for it.
2. **Instance overrides of style.** Is a class on the instance root enough, or do instances need per-prop style
   variants? Proposed: class on the root only, variants through props.
3. **Nesting depth.** Nested components are in (§4.3) with cycles refused; is a depth limit worth having on top?
4. **Flows targeting interior elements from outside.** Refused by the closed scope; confirm no existing seed relies on
   reaching into a referenced subtree.
