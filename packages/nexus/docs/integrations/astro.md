# Nexus + Astro

Works on **Astro 6 (LTS)** and **Astro 7** (released 2026-06-22 — Vite 8 + Rust compiler), via `@astrojs/react`.
Runnable examples: [examples/astro-6](../../examples/astro-6) and [examples/astro-7](../../examples/astro-7).

## The one rule: islands don't share Context

Astro renders each `client:*` component as an **independent React root** (an island). React Context — and therefore
`<StoreProvider>` — does **not** cross island boundaries. This is true on both Astro 6 and 7, and applies to every
Context-based store (Redux, Zustand-with-context, Jotai, …), not just Nexus.

So pick the pattern by scope:

### Island-local state → Provider + hooks

When state belongs to one island and nothing outside needs it, use the normal React pattern inside that island:

```tsx
// Counter.tsx
import { StoreProvider, createStoreHook } from '@plitzi/nexus/react';

const { useStore } = createStoreHook<{ count: number }>();

function Inner() {
  const [count, setCount] = useStore('count');
  return <button onClick={() => setCount(n => n + 1)}>{count}</button>;
}

export default () => (
  <StoreProvider value={{ count: 0 }}>
    <Inner />
  </StoreProvider>
);
```

```astro
---
import Counter from '../components/Counter.tsx';
---
<Counter client:load />
```

### Cross-island state → module singleton

When two or more islands must share state, skip the Provider and put the store in a **module singleton** that every
island imports:

```ts
// store.ts
import { createStore } from '@plitzi/nexus';
export const appStore = createStore(() => ({ count: 0 }));
```

```tsx
// SharedCounter.tsx
import { useStore } from '@plitzi/nexus/react';
import { appStore } from './store';

export default function SharedCounter({ label }: { label: string }) {
  const [count, setCount] = useStore('count', { store: appStore });
  return <button onClick={() => setCount(n => n + 1)}>{label}: {count}</button>;
}
```

```astro
<SharedCounter label="A" client:load />
<SharedCounter label="B" client:visible />   <!-- stays in sync with A -->
```

## SSR safety

Both patterns are SSR-safe out of the box:

- Every `useSyncExternalStore` ships a `getServerSnapshot`, so server render and hydration agree.
- `useLayoutEffect` falls back to `useEffect` on the server (`useIsomorphicLayoutEffect`).
- `persistMiddleware` reads `localStorage` only after mount, so it can't cause a hydration mismatch.

## Version notes

- **Astro 7**: Vite 8 + Rust compiler are defaults; pairs with `@astrojs/react@6` (React 19). No Nexus-specific config.
- **Astro 6 (LTS)**: prior toolchain; identical Nexus code.

Because Nexus no longer relies on `import.meta.env` (it uses `process.env.NODE_ENV` internally), the dev-only warnings
behave identically under Astro/Vite, webpack, esbuild and raw Node.
