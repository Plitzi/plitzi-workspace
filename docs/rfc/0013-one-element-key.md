# RFC 0013 — One element key: `id` becomes the name

- **Status:** Accepted
- **Author:** Carlos Rodriguez
- **Date:** 2026-08-27
- **Scope:** `@plitzi/sdk-schema`, `@plitzi/sdk-shared`, `@plitzi/sdk-elements`, `@plitzi/sdk-mcp`, `apps/builder`, and `plitzi-sdk-server` (transformers, seeds, GraphQL mutations)

---

## 1. Summary

An element answers to three names today, and only one of them is the one anybody
means:

| Field | What it is | Who writes it | Who wires by it |
|---|---|---|---|
| `id` | 24 hex chars, Mongo-shaped, opaque, immutable | `generateID()` | the tree: `flat` key, `parentId`, `items[]`, `rootId`, `pages[]` |
| `idRef` | a readable name, **opt-in** | a person, in a panel hidden behind a link button | bindings (`<type>_<idRef>`) and interactions |
| `definition.label` | free text, not unique | a person, in the tree | nobody |

This RFC collapses the first two. **`id` becomes the name** — the charset `idRef`
already has — `idRef` disappears from the schema, and no element id is ever a
generated ObjectId again. `label` stays as free display text.

The consequence that matters: **the key an agent, an author or a validator writes
down is the key the runtime wires with.** There stops being a half of the document
that a person can see and a half that only the machine can.

---

## 2. Why now

We are not in production. That deletes the expensive half of this change —
backfilling Mongo, de-duplicating names derived from labels, keeping live spaces
working, open builder sessions, cached screenshots — and leaves only the half that
would be just as expensive to do after launch. Every month this waits, it gets
strictly more costly and never cheaper.

---

## 3. What is true today (measured, 2026-08-27)

- `idRef` is opt-in by design: *"nothing hands one out on its own"*
  ([`sdk-schema/src/helpers/idRef.ts`](../../packages/sdk-schema/src/helpers/idRef.ts)).
  Measured on the MCP's own sample space (`apps/mcp/dev/sample/space.json`):
  **31 elements, 0 idRefs.** A space built by dragging in the builder is a space an
  agent can only address by hex.
- The MCP pays for that with a **dual index**: `elementByRef` holds *both* the id
  and the idRef, "first writer wins on a ref collision"
  (`apps/mcp/src/modules/mcp/helpers/space.ts:105-135`), plus `ensureIdRef`
  minting refs mid-write (`.../tools/operations/schema/write.ts:160`), plus prompt
  text that has to say *"Never invent IDs"*.
- The confusion is already in the types: `ElementInteraction.elementId` is typed
  `Element['id']` and its own comment says it holds an **idRef**
  (`sdk-shared/src/types/SchemaTypes.ts`).
- `FlatMap.cloneElements` (`sdk-schema/src/helpers/FlatMap.ts:266`) remaps ids by
  **string-replacing the serialized JSON** — `dataStr.replace(new RegExp(id, 'g'), …)`.
  It is only safe because an id is 24 improbable hex chars, and the regex is
  unescaped. This is the single hardest blocker to readable ids, and it is on the
  path every template instantiation takes.
- A rename is already broadcast wrong: `SpaceUpdateElementMutation` publishes **one**
  element while `FlatMap.updateElement` → `repointIdRefs` has just rewritten many.
  Other collaborators keep stale bindings until they reload.
- The precedent that this design is right is already in the codebase: **flow node
  ids are readable and load-bearing.** A flow's scope is keyed by node id, so
  `{{ login.values.username }}` resolves only because someone called that step
  `login` (`sdk-schema/src/authoring/flows.ts:55`). Unnamed means unreachable.
- `authorSpace` already lives in the target model: it always assigns a ref and
  derives the id from it (`sdk-schema/src/authoring/space.ts:414,462`).
- The test blast radius is small: **4 files** in the workspace and **1** in
  `plitzi-sdk-server` contain 24-hex literals. `generateID` already returns
  `id_000000` under test mode — a crutch that disappears with this change.

---

## 4. The target model

```
Element = {
  id: string          // the name. Unique per document. ID_CHARSET.
  attributes: {...}
  definition: { label, type, parentId, items[], rootId, ... }
}
```

- **Charset** — unchanged from `ID_REF_RE`: starts with a letter, then letters,
  digits, hyphens and underscores; **never a `.`**. Two reasons, both load-bearing:
  a source name is `<type>_<id>` and splits on the first `_` (element types are
  camelCase, so inner underscores stay unambiguous), and `flat` is read and written
  through lodash paths (`get(flat, id)`, `set(flat, \`${id}.definition.rootId\`)`),
  which a `.` would split.
- **Uniqueness** is per document — the space schema, and each segment separately.
  Unchanged from `idRef` today, and unchanged by the fact that a segment referenced
  N times repeats its ids in the rendered tree (`rootId`/`referenceId` disambiguate,
  as they do now).
- **Assignment** — every element gets one at creation: what the author or agent
  named it, or auto-minted from its type. Never absent. How it is minted is §4.1.
- **Renaming** is an explicit operation that repoints every reference in the
  document, structural ones included.

### 4.1 Minting: generated, and predictable on purpose

Ids stay **generated** — nobody is asked to name every element. What changes is that
predictability stops being inferred from the environment and becomes something a
caller passes in. A generated id has to be unique without asking anybody, and two
situations want different answers:

| | Who writes | What it needs | Answer |
|---|---|---|---|
| **Live editing** — builder, MCP | many writers, concurrently | uniqueness with no coordination round trip | `<type>-<4 random chars>` |
| **Offline authoring** — `authorSpace`, seeds, transformers | one writer, start to finish | byte-identical output when re-run | `<type>-<n>`, positional |

Random for the live path because a counter means two collaborators both mint
`heading-3` and one of the two writes is refused — discovered at the merge, which is
the worst moment. At the scale of a document (a few hundred elements) four random
characters are plenty, and an auto-minted name is a default the author renames.

Deterministic for the authored path because a seed re-run must not churn what it
wrote last time — that is why `authoringId` hashes the path today — and because
`yarn author` writes JSON that is diffed against a committed copy.

**The seam.** `generateID` returns `id_000000` when `process.env.NODE_ENV === 'test'`
(`sdk-shared/src/helpers/utils.ts:34`, through `isTestMode()`, whose **only** caller
it is). Right idea, wrong place: a leaf utility that sniffs the environment and
changes what production code does. It goes away with the function, and comes back
explicitly:

- [ ] `FlatMapProps` gains `mintId?: (type: string, taken: Set<string>) => string`,
      defaulting to the random minter.
- [ ] Tests pass a counter — `heading-1`, `heading-2`, … — and get repeatable ids by
      construction, from one line in a test factory, with no environment involved.
- [ ] `authorSpace` passes its positional minter, which is what `nextRef(type)`
      already is (`sdk-schema/src/authoring/space.ts:462`).
- [ ] Nothing anywhere reads `NODE_ENV` to decide what an id looks like; `isTestMode`
      is deleted with `generateID`.

**Counter or seeded random, in tests?** A counter (`heading-1`) reads well in an
assertion and diffs cleanly, which is most of the point; a seeded random source
(`heading-x7k2`) instead keeps the *shape* production actually emits, so a test can
catch a format bug the counter would hide. Take the counter as the default, and let
the handful of tests that are about the id format itself pass a seeded source —
`mintId` is one parameter, so both are the same seam and neither is a special case.

**Alternative**, if threading a prop proves noisy — `FlatMap` is constructed in many
places: a module-level `setIdMinter()` called once from the test setup file. Cheaper
to adopt, but it is global mutable state shared by every suite in a process, which is
the failure mode `isTestMode()` already has. Take it only if the constructor prop is
genuinely painful, not to save the first hour.

**Consequence for snapshots:** any test that asserts on an id, or on `data-id` in
rendered DOM, has to go through the injected minter — a golden file with a random id
baked into it will flap.

---

## 5. Phases

### Phase 0 — Two bugs that are preconditions anyway

Independent value; ship first, on their own.

- [ ] Rewrite `FlatMap.cloneElements` as a **structural remap** (walk elements and
      rewrite known reference fields) instead of a regex over serialized JSON.
      Fixes the unescaped `new RegExp(id)` and stops ids being replaced inside
      prose, labels, class names and content.
- [ ] Fix the rename broadcast: `SpaceUpdateElementMutation` (and the segment twin)
      must publish **the set FlatMap actually repointed**, not the one element the
      caller sent. Same for `SpaceUpdateElementsMutation`.
- [ ] Tests for both: a clone whose text contains another element's id, and a
      rename observed by a second connection.

### Phase 1 — Every element has a name

- [ ] `FlatMap.addElement` mints an id when none is given, through the injectable
      minter of §4.1. Nothing else mints element ids.
- [ ] Builder: the tree's **"Name"** field writes the id (slugified, uniquified);
      the hidden "Reference" input in `ElementDefinitionSettings.tsx` goes away.
      `label` stays as the free display text.
- [ ] Conflict/validation messages phrased for a person (they already are, in
      `idRefConflict`).

### Phase 2 — Collapse `idRef` into `id`

- [ ] `Element.idRef` removed from `sdk-shared/src/types/SchemaTypes.ts`.
      `ElementInteraction.elementId` keeps its type and its comment becomes true.
- [ ] `sdk-schema/src/helpers/idRef.ts` → `elementId.ts`; `repointIdRefs` →
      `repointIds`, **extended to structural references**: the `flat` key,
      `definition.parentId`, `definition.items[]`, `definition.rootId`,
      `schema.pages[]`, `interactions.elementId`, binding `source` tokens and
      `transformers`/`when` tokens, the `url` param of a `navigate` step when
      `urlType === 'page'`, and `reference` elements' `referenceId` /
      `referenceContainer`.
- [ ] Delete the ObjectId generators for elements:
      | Site | What it identifies | Becomes |
      |---|---|---|
      | `sdk-shared/helpers/utils.ts:20,33` (`mongoObjectId`, `generateID`) | elements | deleted |
      | `sdk-mcp` `helpers/space.ts:565` (`generateObjectId`) | elements, pages, bindings | deleted |
      | `plitzi-sdk-server` `HtmlParser.ts:12`, `naturalToSchema/**/parseDefault.ts`, `getRootNode.ts` | imported elements | derived from tag/class/heading text |
      | `sdk-schema/authoring/ids.ts` (`authoringId`, `digest`) | authored elements | deleted |
      | builder: `ElementHelper.ts:31`, `BuilderHelper.ts:204`, `DirectoryHeader.tsx:56`, `useDragElement.ts:62` | elements/pages | `FlatMap` mints |
      | builder: `DataSourceBinding.tsx:52` | a binding | see open question 1 |
      | builder: `WorkflowContextProvider.tsx:44` | a flow node | see open question 1 |
- [ ] Mongo `_id` of `Space` / `Segment` documents is **untouched** — that is a real
      ObjectId and stays one.

### Phase 3 — MCP alignment

- [ ] Delete `ensureIdRef`, `elementRefOf`, and the dual index: `elementByRef` holds
      one key per element, and a ref collision stops being a thing that can happen.
- [ ] `resolveRef` becomes a map lookup; `pageRefOf`'s idRef→slug→label fallback
      chain collapses to the id (a page's `slug` stays what it is: routing).
- [ ] Tool descriptions: *"Never invent IDs"* becomes *the id is the name you give
      it*, which is also what the builder shows.

### Phase 4 — Seeds, examples and tests

- [ ] The 5 seed spaces in `plitzi-sdk-server/prisma/mongo/seeds/spaces/*.ts` and
      `apps/server/examples/**` re-authored with semantic ids throughout.
- [ ] `authorSpace` stops deriving a positional ref that is deliberately excluded
      from the source table — with one key, a derived id is a real id; decide
      whether an author must name anything a binding points at (recommended: yes,
      keep the current error).
- [ ] Fixtures: the 4 workspace files with hex literals + 1 in `plitzi-sdk-server`.
      Suites that create elements adopt the counter minter of §4.1 — ids stay
      repeatable, and they become readable in the assertions too, which is most of
      why this is worth doing to the tests at all.

### Phase 5 — Not in this RFC, unblocked by it

A document whose every key is a name a person chose is a document that can be
written and reviewed as **YAML → JSON**. That becomes a small, separate RFC once
this lands, not a reason to widen this one.

---

## 6. Consequences we accept

- **A rename resets the element's runtime state.** Element state lives at
  `runtime.elements.<id>` (`sdk-elements/src/Element/hooks/useElementState.ts:19`),
  the id is the React key, and `data-rsc-id` correlates the SSR and client renders
  (`RootElement.tsx:66`). Renaming remounts. See open question 2.
- **Names degrade in cloned content.** Dropping the same template three times gives
  `hero`, `hero-2`, `hero-3`. Unavoidable with any readable unique key; it already
  happens to `idRef`, only invisibly because almost nothing carries one.
- **Ids are now mutable.** Every write path has to treat a rename as a document-wide
  operation, which is exactly what Phase 0 and Phase 2 pay for.

---

## 7. Open questions

1. **Sub-ids.** Do binding ids, flow node ids and page-folder ids also become
   semantic here, or do they just stop being Mongo-shaped? Flow nodes already have
   `named()` and a scope keyed by node id, so they are the strongest candidate;
   bindings are element-local and could be `<category>-<n>`.
2. **Rename and element state.** Move the `runtime.elements.<id>` slice with the
   rename, or accept the reset? Moving it is a few lines in `useElementState` plus a
   rename event; accepting it is free and probably fine for an operation this rare.
3. **Uniqueness scope.** Per document (today's behaviour) or per space across all
   its segments? Per document is cheaper and is what `takenIdRefs` already means.
