# Nexus + Astro 6 (LTS)

Astro **6.x**, the current LTS line, with `@astrojs/react`. Same two patterns as the [astro-7](../astro-7) example —
the `src/` code is identical; only the toolchain version differs.

```bash
yarn dev
```

## Patterns

1. **Cross-island state → module singleton** ([`src/store.ts`](./src/store.ts) + [`SharedCounter.tsx`](./src/components/SharedCounter.tsx)).
   React Context does not cross island boundaries, so shared state lives in one `createStore` singleton imported by
   every island.
2. **Island-local state → Provider + hooks** ([`ProviderCounter.tsx`](./src/components/ProviderCounter.tsx)).

Keep this example on the LTS line to catch any regression that would only surface on the older toolchain.
