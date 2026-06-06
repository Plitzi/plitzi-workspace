# @plitzi/sdk-store — website

The marketing + docs landing page for [`@plitzi/sdk-store`](../../packages/sdk-store). A Vite + React + Tailwind app
that **dogfoods the store straight from `../../packages/sdk-store/src`** — the live demos (path subscriptions, scoped
stores, time-travel) always reflect every feature in the repo, with no npm round-trip.

It lives under a top-level `websites/` folder — intentionally **outside** `apps/` and `packages/` — so it is not part
of the monorepo's yarn/turbo workspaces and never interferes with package builds, installs, or publishing. It has its
own `package-lock.json` and uses npm.

## Develop

```bash
cd websites/sdk-store
npm install
npm run dev      # http://localhost:5173
```

## Build

```bash
npm run build    # → dist/
npm run preview  # serve the production build locally
```

## Benchmark

The store benchmark (same code as the site's "How it compares" section) can run in the terminal:

```bash
npm run bench         # vite-node runs the real stores against four workloads and prints a table
npm run bench:nested  # scope-chain scaling: cost of N nested <StoreProvider> scopes by depth
npm run bench:react   # nested <StoreProvider> vs nested React context (jsdom render benchmark)
```

`bench` compares `@plitzi/sdk-store`, Zustand, Jotai and a notify-all baseline across `wide`, `hot`, `nested` and
`churn` scenarios. The per-store implementations live in `src/components/Benchmark/bench/` (one file each:
`sdkStore.ts`, `zustandStore.ts`, `jotaiStore.ts`, `naiveStore.ts`), composed by `bench/scenarios.ts` and shared
by both the CLI (`bench/cli.ts`) and the browser widget.

`bench:nested` (`bench/nestedScope.ts` + `bench/nestedCli.ts`) models the case of hundreds/thousands of nested
providers — a chain of live-scoped stores — and isolates the three depth-dependent costs (leaf reads of an ancestor
source, root writes that cascade to a deep leaf, and mount), pitting the live chain against disconnected scopes.

`bench:react` (`bench/reactBench.tsx` + `bench/reactCli.ts`) actually renders the deep tree under jsdom three ways —
nested React context, nested `<StoreProvider inherit="live">`, and disconnected `<StoreProvider>` — and reports
mount/update time plus how many components re-render per update, the decisive number when replacing nested context.
It can run thanks to `resolve.dedupe: ['react', 'react-dom']` in `vite.config.ts` (sdk-store source and react-dom
must share one React copy).

## Deploy

Deployment is automated via [`deploy-website.yml`](../../.github/workflows/deploy-website.yml): it builds and
publishes to **GitHub Pages on every published release** (and on manual `workflow_dispatch`).

One-time setup in the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

### Base path

The app is served from a GitHub project page (`https://<org>.github.io/plitzi-workspace/`), so `vite.config.ts`
sets `base: '/plitzi-workspace/'`. If you attach a custom domain (served from root), build with `VITE_BASE=/`:

```bash
VITE_BASE=/ npm run build
```

## How it consumes the store

`vite.config.ts` aliases `@plitzi/sdk-store` and `@plitzi/sdk-store/history` to `../../packages/sdk-store/src`
(mirrored by `paths` in `tsconfig.json`). The `LiveDemo` wraps the real `StoreProvider` and uses `createStoreHook` +
`useStoreHistory` — the same primitives documented on the page.

## Structure

```
src/
  App.tsx              page composition
  content.ts           copy, feature list, code samples, links
  components/
    Nav/ Hero/ FeatureGrid/ CodeShowcase/ LiveDemo/ Ecosystem/ Footer/
    CodeBlock/ SectionHeading/
```
