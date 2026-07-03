# @plitzi/nexus

## 0.32.2

### Patch Changes

- v0.32.2

## Unreleased

### Minor Changes

- Framework-agnostic core. The **package root `@plitzi/nexus` is now the agnostic core** (zero React): `createStore`,
  imperative `get/set/watch`, middlewares, and the async/derived/entities primitives. React bindings live in
  `@plitzi/nexus/react` (`StoreProvider`, `createStoreHook`, all hooks, `useEntity`); Next.js helpers in
  `@plitzi/nexus/next`. Source is organized to match: `src/react/`, `src/next/`, and the agnostic modules at the top
  level.
- Removed the Vite-only `import.meta.env.MODE`; dev/prod/test detection now uses `process.env.NODE_ENV`, so the
  dev-only warnings behave identically under webpack, esbuild, Rollup, Bun, raw Node and Vite/Astro.
- Added a first-class **Vue 3 integration** at `@plitzi/nexus/vue`: `provideStore` / `injectStore`, `useStore`
  (writable ref / `v-model`), `useStoreValue`, `createStoreComposable`, `useEntity*`, `useDerived`, `useAsync`, and
  `useStoreHistory`. `vue` is an optional peer dependency (`^3.4`).
- Added runnable examples (`examples/`) and integration docs (`docs/integrations/`) for React, Next.js, Astro 6 (LTS),
  Astro 7, Vue and Svelte.

### Breaking Changes

- **React bindings moved out of the root.** Import `StoreProvider`, `createStoreHook`, `useStore`, `useStoreHistory`,
  etc. from `@plitzi/nexus/react` instead of `@plitzi/nexus` (or the old `/createStore`, `/StoreProvider`,
  `/StoreContext` subpaths). The root now exports only the agnostic core. Agnostic symbols (`createStore`, middlewares,
  `createServerSnapshot`, types) stay on the root.
- `createEntityStore` is now framework-agnostic and no longer exposes `useOne` / `useIds` / `useAll` on the returned
  object. Use the React bindings instead: `const { useOne, useIds, useAll } = useEntity(store)`, or the standalone
  `useEntityOne(store, id)` / `useEntityIds(store)` / `useEntityAll(store)` from `@plitzi/nexus/react`.

## 0.32.1

### Patch Changes

- v0.32.1

## 0.32.0

### Minor Changes

- v0.32.0

## 0.31.2

### Patch Changes

- v0.31.2

## 0.31.1

### Patch Changes

- v0.31.1

## 0.31.0

### Minor Changes

- v0.31.0

## 0.30.19

### Patch Changes

- v0.30.19

## 0.30.18

### Patch Changes

- v0.30.18

## 0.30.17

### Patch Changes

- v0.31.0
