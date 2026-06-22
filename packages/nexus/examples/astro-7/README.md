# Nexus + Astro 7

Astro **7.0** (released 2026-06-22) on Vite 8 with the Rust compiler as default, using `@astrojs/react@6` (React 19).

```bash
yarn dev
```

## Two patterns, one rule

Astro renders each `client:*` component as an **independent React root (island)**. React Context does **not** cross
island boundaries — so Nexus is used two ways:

1. **Cross-island state → module singleton.** [`src/store.ts`](./src/store.ts) creates one `appStore` with
   `@plitzi/nexus`. Every island imports it and binds with `useStore('count', { store: appStore })`
   ([`SharedCounter.tsx`](./src/components/SharedCounter.tsx)). The two `<SharedCounter>` islands on the page stay in
   sync. **No Provider is involved.**

2. **Island-local state → Provider + hooks.** [`ProviderCounter.tsx`](./src/components/ProviderCounter.tsx) wraps its
   own tree in `<StoreProvider>` and uses `createStoreHook` — the ordinary React pattern, scoped to that one island.

SSR is safe in both: every `useSyncExternalStore` ships a server snapshot, and persisted state hydrates after mount.

The only difference from the [astro-6](../astro-6) example is the toolchain version — the Nexus code is identical,
which is the whole point of the agnostic core.
