# Nexus → Framework-Agnostic Core: Migration Plan

> Status: **Implemented** (2026-06-22) · Owner: Carlos · Target package: `@plitzi/nexus`
>
> **Final shape (revised from the original plan below):** the **package root IS the agnostic core** — no separate
> `core/` folder, no `/core` subpath. React bindings live physically in `src/react/` (`@plitzi/nexus/react`), Next.js
> in `src/next/` (`@plitzi/nexus/next`). The agnostic modules stay at `src/` top level (`createStore/`, `async/`,
> `derived/`, `entities/`, `middleware/`, `helpers/`, `rsc/`, `types/`, `env.ts`). `createStoreHook` and the entity
> hooks were extracted to `src/react/`; `import.meta.env` was replaced by `src/env.ts` (`process.env.NODE_ENV`).
>
> Because the root became agnostic, the **99 workspace consumers were codemodded**: React symbols → `@plitzi/nexus/react`,
> core symbols → `@plitzi/nexus`, Next → `@plitzi/nexus/next`. Verified: nexus `typecheck` + `lint` (0 errors) +
> **576 tests** + clean build; consumer packages (sdk-elements, sdk-shared, sdk-dev-tools, sdk-style) and apps
> (builder, sdk) typecheck with zero nexus-related errors.
>
> Examples under `examples/` (react, next, astro-6, astro-7, vue, svelte); integration docs under `docs/integrations/`.
> Intentional breaking change: `createEntityStore` no longer carries `useOne/useIds/useAll` — use `useEntity` from
> `@plitzi/nexus/react`.
>
> Goal: turn Nexus into a **framework/library-agnostic state core** with thin, per-framework
> integration layers. React and Next.js stop being baked into the core and become integrations.
> Add real, runnable examples per framework (React, Next.js, Astro 6 LTS, Astro 7, Vue, Svelte),
> and remove the Vite-only `import.meta.env.MODE` so Nexus behaves identically under webpack,
> esbuild, Rollup, Bun and Node.

---

## 1. Why

- The vanilla store (`createStore`, imperative `get/set/watch`, middlewares, entities, async,
  derived) has **zero intrinsic dependency on React** — it's already a standalone reactive core.
- The React bindings (Context, `StoreProvider`, all `use*` hooks) are the only React-coupled part,
  plus the Next.js helper. Keeping them in the root forces every consumer (including non-React and
  SSR/island runtimes like Astro) to pull React semantics they may not use.
- Astro shipped **7.0 today (2026-06-22)** (Vite 8, Rust compiler default) and **6.x remains LTS**.
  Both run React only inside isolated **islands**, where React Context does **not** cross island
  boundaries — so an agnostic core + a documented singleton pattern is the correct fit.

---

## 2. Current coupling inventory

Mapped from `src/`. This is the ground truth the refactor must preserve.

### 2.1 Pure core (no React — moves to `core/` unchanged)

- `createStore/createStore.ts` + all `createStore/helpers/*` (PathTrie, Subscribers, createChainReads,
  createSetState, deepMerge, forwardParentChanges, scopeCollisions, writeByPath)
- `async/createAsync.ts`
- `derived/createDerived.ts`
- `entities/createEntityAdapter.ts`
- `middleware/*` (logger, persist, history, reduxDevTools, cascade, isDisabled)
- `helpers/*` except `useIsomorphicLayoutEffect.ts` (getByPath, setByPath, isPathAffected,
  parsePath, shallowEqual, createObservable)
- `history/*` core (the `historyMiddleware`)
- `rsc/index.ts` — pure (only a `Symbol` flag; **no** React import despite the name)
- `types/*`

### 2.2 React-coupled (12 source files — move to `integrations/react/`)

- `StoreContext.ts` — `createContext` (the binding root)
- `StoreProvider.tsx`
- `createStore/hooks/shared.ts`, `useStore.ts`, `useStoreGetter.ts`, `useStoreSetter.ts`,
  `useStoreSync.ts`, `useStoreById.ts`
- `async/hooks/useAsync.ts`, `async/hooks/useAsyncValue.ts`
- `derived/hooks/useDerived.ts`
- `history/hooks/useStoreHistory.ts`
- `helpers/useIsomorphicLayoutEffect.ts`

### 2.3 Mixed file — must be SPLIT

- `entities/createEntityStore.ts` — the vanilla `EntityStore` (data + `subscribe*`) and the React
  hooks (`useOne` / `useIds` / `useAll`) live in **one exported object**. Core keeps the data store
  and its `subscribe*` methods; the three hooks move to `integrations/react` (either as standalone
  hooks bound to a store, or attached via a small `withReact(entityStore)` adapter).

### 2.4 Next.js-coupled (moves to `integrations/next/`)

- `next/index.ts` — `bindServerAction`, dynamic `import('next/cache')`. No React import but App-Router
  specific.

### 2.5 Vite-only runtime assumption (to remove — §6)

- `import.meta.env.MODE` used in 5 places: `StoreProvider.tsx:101`,
  `createStore/createStore.ts:165,361,365`, `history/hooks/useStoreHistory.ts:26`.

---

## 3. Target structure

```
packages/nexus/
  src/
    core/                      # 100% agnostic, zero React, zero bundler globals
      createStore/
      async/createAsync.ts
      derived/createDerived.ts
      entities/                # createEntityAdapter + vanilla createEntityStore (no hooks)
      middleware/
      helpers/                 # minus useIsomorphicLayoutEffect
      history/                 # historyMiddleware (core)
      rsc/                     # server-snapshot flag (pure)
      types/
      env.ts                   # NEW — bundler-agnostic dev/prod/test (§6)
      index.ts                 # core public surface
    integrations/
      react/
        StoreContext.ts
        StoreProvider.tsx
        hooks/                 # useStore, useStoreGetter/Setter/Sync/ById, useAsync(+Value),
                               # useDerived, useStoreHistory, useEntity (useOne/useIds/useAll)
        useIsomorphicLayoutEffect.ts
        index.ts
      next/
        index.ts
      # future: vue/, svelte/, solid/, astro/  (see §5 + §7)
    index.ts                   # back-compat root: re-export core + react (+ rsc)
  examples/
    react/
    next/
    astro-6/                   # Astro 6 LTS
    astro-7/                   # Astro 7
    vue/                       # placeholder for future binding
    svelte/                    # placeholder for future binding
  docs/
    agnostic-core-migration.md # this file
    integrations/              # per-framework usage docs
```

### Package `exports` map (target)

| Subpath | Resolves to |
|---|---|
| `.` | back-compat root (core + react) |
| `./core` | agnostic core only |
| `./react` | React integration |
| `./next` | Next.js integration |
| `./advanced` | unchanged curated surface (re-pointed at new paths) |
| `./rsc` | server-snapshot helpers (add explicit subpath) |
| future | `./vue`, `./svelte`, `./astro` |

**Back-compat is non-negotiable:** the root `.` must keep exporting every symbol it exports today
(`createStore`, `StoreProvider`, all hooks, middlewares, `createServerSnapshot`…). The move is
internal; existing imports `from '@plitzi/nexus'` keep working.

---

## 4. Task breakdown

### Phase 0 — Prep
- [ ] Branch `nexus-agnostic-core`.
- [ ] Snapshot current public API surface (export list from `dist/index.d.ts`) as a back-compat
      contract to diff against at the end.
- [ ] Confirm `generate-exports.mjs` (sdk-shared script) behavior so the new subpaths are emitted.

### Phase 1 — Extract agnostic `core/`
- [ ] Create `src/core/` and move all §2.1 files preserving internal relative imports.
- [ ] Split `entities/createEntityStore.ts`: keep vanilla store + `subscribe*` in `core/entities`;
      remove `useOne/useIds/useAll` from the core object (they go to React in Phase 2).
- [ ] Add `core/index.ts` exposing the agnostic surface: `createStore`, imperative store API,
      `createAsync`, `createDerived`, `createEntityAdapter`, `createEntityStore`, all middlewares,
      `cascade`, `createServerSnapshot`/`isServerSnapshot`, and all public types.
- [ ] `yarn typecheck` green for core in isolation (no React types leaking in).

### Phase 2 — `integrations/react/`
- [ ] Move §2.2 files into `integrations/react/` (Context, Provider, hooks, isomorphic effect).
- [ ] Re-point their imports at `../../core/*`.
- [ ] Re-home the entity hooks: `useEntity(store)` exposing `useOne/useIds/useAll`, or keep the
      three as named hooks. Update entity tests accordingly.
- [ ] `integrations/react/index.ts` exports the full React surface.

### Phase 3 — `integrations/next/`
- [ ] Move `next/index.ts` → `integrations/next/index.ts`; re-point types at `../../core/types`.
- [ ] Verify the dynamic `next/cache` import path and the `'use client'`/server-action contract.

### Phase 4 — Remove `import.meta.env.MODE` (§6)
- [ ] Add `core/env.ts`.
- [ ] Replace all 5 usages with the new helper (or inline `process.env.NODE_ENV` for DCE — see §6).
- [ ] Verify dev-only warnings still tree-shake out of a production build.

### Phase 5 — Wire up `package.json` exports + back-compat root
- [ ] Update `exports` map: add `./core`, `./react`, `./rsc`; keep `.`, `./next`, `./advanced`,
      `./middleware`, `./async`, `./derived`, `./entities`, `./history`, `./types`.
- [ ] Rewrite root `src/index.ts` to re-export from `core` + `integrations/react` (+ `rsc`),
      matching the Phase 0 contract exactly.
- [ ] Re-point `advanced/index.ts` at the new locations.
- [ ] Update `vite.config` / `tsconfig` includes if entry globs are path-based.

### Phase 6 — Examples (`examples/`)
- [ ] `examples/react/` — Vite + React 19, Provider + hooks, persist + history.
- [ ] `examples/next/` — App Router, `createServerSnapshot` + `bindServerAction`.
- [ ] `examples/astro-6/` — **Astro 6 LTS**: a React island using the Provider **inside** one island,
      plus a **module-singleton store shared across islands** (the cross-island pattern, §5).
- [ ] `examples/astro-7/` — **Astro 7** (Vite 8 / Rust compiler): same two patterns, on the new
      `@astrojs/react@6`.
- [ ] `examples/vue/`, `examples/svelte/` — minimal placeholders consuming `@plitzi/nexus/core`
      directly via `subscribe`/`getState` until dedicated bindings exist (§7).
- [ ] Each example: README + `yarn dev` script + a screenshot or note proving it runs.

### Phase 7 — Documentation
- [ ] Update root `README.md`: new import paths, "agnostic core" positioning, the integrations table.
- [ ] `docs/integrations/react.md`, `next.md`, `astro.md` (covers 6 LTS + 7 + island caveat).
- [ ] Migration note: "imports from the root still work; prefer `@plitzi/nexus/react` going forward."
- [ ] `CHANGELOG.md` entry (minor, additive — no breaking root API).

### Phase 8 — Verification (gate)
- [ ] `yarn typecheck` — 0 errors.
- [ ] `yarn lint` — 0 errors.
- [ ] `yarn test` — all green (entity-store split is the riskiest; assert hook + core parity).
- [ ] `yarn build:dev` then diff exported `.d.ts` against the Phase 0 contract — **no removals**.
- [ ] Smoke-build at least the `astro-7` and `next` examples against the freshly built `dist`.

---

## 5. Astro specifics (6 LTS + 7)

Both versions share the same constraint and the same solution.

- **Inside a single island** (`client:load` / `client:visible` / `client:idle`): `StoreProvider` +
  hooks work as-is. SSR is safe — every `useSyncExternalStore` already passes a `getServerSnapshot`,
  `useLayoutEffect` is guarded via `useIsomorphicLayoutEffect`, and `persistMiddleware` reads storage
  only after mount, so there is no hydration mismatch.
- **Across islands**: React Context does **not** cross island boundaries (true in Astro 6 and 7, and
  for every Context-based store). Sharing must use a **module-level singleton**:

  ```ts
  // store.ts  (shared module, imported by every island)
  import { createStore } from '@plitzi/nexus/core';
  export const appStore = createStore(() => ({ count: 0 }));
  ```
  ```tsx
  // IslandA.tsx / IslandB.tsx  ('client:*')
  import { appStore } from './store';
  import { useStore } from '@plitzi/nexus/react';
  const [count, setCount] = useStore('count', { store: appStore });
  ```

- **Version differences to validate in examples**: Astro 7 runs Vite 8 + the Rust compiler and pairs
  with `@astrojs/react@6` (React 19); Astro 6 LTS runs the prior toolchain. Both must build green
  against the same `dist`. This is also the reason §6 matters: an Astro/Vite-only env primitive
  would have hidden these as "works on my Astro."

Action items for Astro are folded into Phase 6 (`astro-6`, `astro-7` examples) and Phase 7
(`docs/integrations/astro.md`).

---

## 6. Removing `import.meta.env.MODE`

`import.meta.env` is defined by **Vite/Astro only**. Under webpack, esbuild, Rollup, Bun or raw Node
it's `undefined` (or a hard error in some setups), so the dev-only guards silently misbehave.

**Recommended primitive:** `process.env.NODE_ENV` — statically replaced by webpack, Next, esbuild,
Rollup and Vite alike, and the de-facto standard used by React/Redux/Zustand.

`src/core/env.ts`:

```ts
// Bundler-agnostic dev/prod/test detection. Avoids `import.meta.env` (Vite/Astro-only) so Nexus
// behaves identically under webpack, esbuild, Rollup, Bun, Node and Vite. `process.env.NODE_ENV`
// is statically replaced by every major bundler; the runtime guard covers plain Node/ESM.
const resolveMode = (): string => {
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) {
    return process.env.NODE_ENV;
  }

  return 'production';
};

export const MODE = resolveMode();
export const isProd = MODE === 'production';
export const isDev = !isProd;
export const isTest = MODE === 'test';
```

**Trade-off to decide during Phase 4:** a runtime `const isDev` is ergonomic but is *not* statically
eliminated, so dev-only warning blocks would ship in the bundle (just never run). If guaranteed
dead-code elimination in production is required, keep the comparison **inline** at each call site:

```ts
if (process.env.NODE_ENV !== 'production') { /* dev warning */ }
```

so minifiers can drop the branch. Suggested rule: use inline `process.env.NODE_ENV` for the
warning/dev-only blocks (DCE-friendly), and `env.ts` for any value actually read at runtime.
Document in `docs/integrations/*` that webpack/esbuild users should define `NODE_ENV` (most already do
via `mode`).

---

## 7. Future framework bindings (out of scope for this pass, tracked here)

Once core is isolated, dedicated bindings can be added without touching core:
- `integrations/vue/` — `useStore` composable over `subscribe`/`getState`.
- `integrations/svelte/` — a `readable`/store-contract adapter.
- `integrations/solid/` — signal adapter.
- `integrations/astro/` — optional sugar for the singleton pattern.

The `examples/vue` and `examples/svelte` placeholders (Phase 6) consume `@plitzi/nexus/core`
directly in the meantime to prove the core is genuinely framework-agnostic.

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Splitting `createEntityStore` breaks the single-object API | Keep core `subscribe*` intact; add a `useEntity(store)` adapter so the hook ergonomics survive; parity tests. |
| Root API surface drifts (silent breaking change) | Phase 0 `.d.ts` contract diffed in Phase 8 — fail on any removal. |
| Dev warnings ship to prod after env change | Use inline `process.env.NODE_ENV` for DCE-sensitive blocks (§6). |
| Portal consumers read from `dist` | Rebuild (`build:dev`) after the move before validating dependents. |
| Astro 6 vs 7 toolchain divergence | Two separate examples built against the same `dist` in Phase 8. |
