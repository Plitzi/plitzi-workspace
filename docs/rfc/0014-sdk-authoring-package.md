# RFC 0014 — `@plitzi/sdk-authoring`, and authoring a template

- **Status:** Accepted
- **Author:** Carlos Rodriguez
- **Date:** 2026-08-27
- **Scope:** new package `@plitzi/sdk-authoring`; `@plitzi/sdk-schema` (authoring); `apps/sdk` and `apps/server` (their `/authoring` entries); `docs/en`

---

## 1. Summary

Two things, and the second is the reason for the first:

1. **`authorTemplate()` / `validateTemplate()`** — the authoring surface produces
   *spaces*; it cannot produce a **template**, which is the artefact someone
   publishes when they are not building an app.
2. **A package of its own** — so a person who only writes templates installs one
   dependency with nothing behind it, instead of the whole React SDK.

**Explicit non-goal:** moving the per-package `/authoring` fragments. They stay
exactly where they are. Section 4 says why.

---

## 2. Why: the template author

A template is a plain JSON manifest ([`sdk-shared/src/types/BuilderTypes.ts:4`](../../packages/sdk-shared/src/types/BuilderTypes.ts)):

```ts
Template = { definition: { name, description, baseElementId }, schema, style }
```

It is fetched by URL (`fetchManifest`), shown in the Resources panel, dragged onto
the canvas, and instantiated with `FlatMap.cloneElements`
(`apps/builder/src/modules/Elements/hooks/useDragElement.ts:75`). It is published by
uploading it as an `application/json` resource, which lands in `templates/` on the
space's CDN (`plitzi-sdk-server` `SpaceAddResourceMutation.ts:115`) — **with no
validation of its shape at any point**.

So the whole job of a template author is: produce a valid JSON and host it. No
server, no account, no `@plitzi/sdk-server`. Today, to write that JSON, they must
install `@plitzi/plitzi-sdk` — Apollo, plitzi-ui, react-router, graphql, the lot —
and they have no function that produces the artefact anyway: they would hand-build
the `definition` wrapper and dig `baseElementId` out of the authored schema.

The builder's own extractor for this exists and is worth reading first:
`FlatMap.flatAsTemplate` (`sdk-schema/src/helpers/FlatMap.ts:471`), called from
`BuilderTree.tsx:167`, `BuilderAreaTracking.tsx:221`, `BuilderProvider.tsx:361` and
`SegmentsContextProvider.tsx:497`. It already answers "which styles and variables
travel with this subtree".

---

## 3. What the package is

`@plitzi/sdk-authoring` becomes the **only home** of the authoring surface. Today's
`apps/sdk/src/authoring.ts` (72 lines: the five star re-exports, `STEP_VOCABULARY`,
and the `authorSpace`/`validateSpace` that hold this SDK's vocabularies) moves there
verbatim.

**Nothing re-exports it.** The `./authoring` subpaths on `@plitzi/plitzi-sdk` and
`@plitzi/sdk-server` are removed, not redirected: once authoring is a package of its
own, anyone who needs it depends on it directly, and the SDK, the builder and the
server each go back to being about one thing. It also deletes the arrangement those
two entries needed to keep them honest — `apps/server/src/authoring.test.ts` exists
only to assert that the two doors export the same surface, and with one door there is
nothing to assert. No cycle either: nothing the new package depends on depends back
on it.

It ships **with zero runtime dependencies**. That is not aspirational — the built
entry is already self-contained: `apps/sdk/dist/plitzi-sdk-authoring.js` is 231 KB
with **zero** `import`/`require` statements and no React.

The one thing that does not work yet: `dist/authoring.d.ts` re-exports by specifier
(`export * from '@plitzi/sdk-elements/authoring'`), so the types still require the
five packages installed. `rollupTypes: true` in the dts plugin is the fix, and
proving it works over five packages is a task, not a footnote.

---

## 4. Why the fragments do not move

Measured, so it does not have to be re-argued later:

- **It would invert the dependency into a cycle.** 70 files in `sdk-elements`
  import their own `authoring/declare` (`elementDeclaration`, `AuthorableAttributes`),
  and 8 files in `sdk-interactions` import `authoring/globalCallbacks` and
  `authoring/builder`. Move the fragments out and you get
  `sdk-authoring → sdk-elements → sdk-authoring`. Avoiding it means splitting
  *vocabulary* from *authoring helpers* — which is what the fragments already are.
- **The fragments read package internals on purpose** — `../elements/declarations`,
  `../sources/*/callbacks`, `../helpers/FlatMap`, `../helpers/schemaValidator`,
  `../properties`, `../helpers/twigWrapper` — which is what keeps every declaration
  single-sourced instead of mirrored.
- **The benefits a package is usually wanted for are already achieved.**
  `plitzi-sdk.js` (2.49 MB) contains **zero** occurrences of `authorSpace` or
  `expandShorthand`: the browser bundle carries no authoring code today.

What a package genuinely buys is **install shape for a Node-only consumer**. That is
what this RFC builds, and nothing more.

---

## 5. Phases

### Phase 1 — `authorTemplate` / `validateTemplate`

In `sdk-schema/authoring`, beside `authorSpace`/`validateSpace`.

- [ ] `authorTemplate(spec) → Template`: name, description, and a subtree, producing
      `{ definition: { name, description, baseElementId }, schema, style }`. The root
      of the authored subtree is the `baseElementId`; the author never writes an id
      by hand (with RFC 0013 it is simply the name they gave the root).
- [ ] `validateTemplate(template)`: `validateSpace`'s checks over the fragment, plus
      what only a template can get wrong:
      - `baseElementId` exists in `flat`, and its `definition.parentId` is null;
      - no page elements inside a template;
      - every class named by `styleSelectors` is declared in the accompanying `style`
        (a template that references a class it does not carry renders unstyled in
        someone else's space);
      - **no binding whose source points outside the subtree** — the source does not
        travel with the template, so the binding is dead on arrival. This is the
        failure a template author cannot see and the one that is most worth catching.
- [ ] Read `FlatMap.flatAsTemplate` first and share what is shareable: it already
      decides which style rules and variables belong to a subtree.
- [ ] Decide where `Template` lives (open question 1).

### Phase 2 — The package

- [ ] Create `packages/sdk-authoring`, move `apps/sdk/src/authoring.ts` and
      `apps/sdk/vite.authoring.config.ts` into it (the config's comment about
      deliberately having no aliases onto package sources stays true and stays).
- [ ] `rollupTypes: true`; verify the emitted `.d.ts` names no `@plitzi/*` specifier
      and that `subType: 'h7'` is still a compile error downstream.
- [ ] `dependencies: {}`; the five `@plitzi/*` fragments are build-time only. Same
      version line as the rest of the workspace.
- [ ] Take the old entries out — not aliases of the new one:
      - `apps/sdk`: delete `src/authoring.ts` and `vite.authoring.config.ts`, the
        `./authoring` key in `package.json` exports, and the
        `vite build --config vite.authoring.config.ts` tail on `build:dev` and
        `build:prod`.
      - `apps/server`: delete `src/authoring.ts`, `src/authoring.test.ts` (it exists
        only to compare the two doors) and the `./authoring` key in its exports.
- [ ] Repoint the consumers onto `@plitzi/sdk-authoring`: the seeds in
      `plitzi-sdk-server/prisma/mongo/seeds/spaces/*.ts` (5 spaces plus `layout.ts`
      and `index.ts`) and `examples/**`. `plitzi-sdk-server` gains the package as a
      dependency of its own.

### Phase 3 — What ships with it

- [ ] The `plitzi-authoring` skill moves here from `apps/server/skills/` — the
      package that implements what a skill teaches is the package that owns it —
      and ships from `files: ["dist", "skills"]`, following `@plitzi/sdk-mcp`'s
      `skills/plitzi-render` precedent.
- [ ] **`@plitzi/sdk-server` keeps shipping it too**, and only it: a self-hoster
      installs the server and should find the skill there, without having to know
      that an authoring package exists in order to work with an agent. This is the
      one thing that stays in two tarballs, and it is a file rather than an API, so
      it must be **copied at publish time from the one source** — a `prepack` step
      into `apps/server/skills/`, never a second checked-in copy to keep in sync.
      Add a test that the two are byte-identical if the step is not obviously safe.
- [ ] Rewrite the skill's own imports while moving it: it currently teaches
      `import { authorSpace, … } from '@plitzi/sdk-server/authoring'` (line 17) and
      names both old entries again at lines 35 and 198. One specifier now —
      `@plitzi/sdk-authoring` — which is the same right answer for both audiences,
      so a single file still serves them.
- [ ] `docs/en/authoring-spaces.md` gains a **templates** section: author, validate,
      host, drag.
- [ ] A worked example under `examples/` that authors a template and writes the JSON
      — the smallest possible project, to prove the "one dependency" claim.

### Phase 4 — Verification

- [ ] `npm pack` the package and install it in a project **outside** the monorepo
      (the precedent from the authoring-surface work): assert the dependency tree is
      empty, that authoring a space and a template both work, and that the types
      travel.
- [ ] The produced template JSON survives the real consumption path: `fetchManifest`
      → `useDragElement` → `FlatMap.cloneElements`, in a test.

---

## 6. Relationship to RFC 0013

Independent — start either first. Two touchpoints, neither blocking:

- `cloneElements` is the template instantiation path, and RFC 0013 Phase 0 rewrites
  it as a structural remap. Templates get more correct either way.
- With RFC 0013, `baseElementId` is just the name of the root element, and
  `elementIdOf` stops being needed to find it.

---

## 7. Open questions

1. **Where does the `Template` type live?** It is in `sdk-shared/types/BuilderTypes.ts`
   today, next to collaborator presence types, which is not where a published artefact
   belongs. Moving it to `sdk-schema` is defensible; check what imports it first.
2. **Does the builder's "save as template" flow route through `authorTemplate`?**
   It would mean one definition of what a template is, but the builder's path starts
   from a live schema rather than a spec.
3. **Does the surface-equality test leave anything behind?** `authoring.test.ts` also
   smoke-tests authoring a space end to end in Node with no browser. That half is
   worth keeping — as the new package's own test, not as a comparison.
