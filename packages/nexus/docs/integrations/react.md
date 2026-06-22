# Nexus + React

Import the React bindings from `@plitzi/nexus/react`. The package root `@plitzi/nexus` is the **agnostic core** (zero
React) — `createStore`, middlewares, async/derived/entities, `createServerSnapshot`.

```tsx
import { StoreProvider, createStoreHook, useStoreHistory, useEntity } from '@plitzi/nexus/react';
import { historyMiddleware, persistMiddleware, createEntityStore } from '@plitzi/nexus';
```

| Symbol | Use |
|---|---|
| `StoreProvider` | Provides a store to a subtree (`value`, `inherit`, `middlewares`, `id`, `path`). |
| `createStoreHook<State>()` | Typed `{ useStore, useStoreSync, useStoreGetter, useStoreSetter }`. |
| `useStoreById` / `useStoreSetter` | Cross-provider lookup / write-only setter. |
| `useStoreHistory` | Undo/redo view (needs `historyMiddleware()`). |
| `useAsync` / `useAsyncValue` | Suspense-friendly async resources. |
| `useDerived` | Subscribe to a shared `createDerived` value. |
| `useEntity(store)` / `useEntityOne` / `useEntityIds` / `useEntityAll` | React bindings for an entity store. |

> **Entity stores changed shape.** `createEntityStore` is now agnostic and no longer carries `useOne/useIds/useAll`
> on the returned object. Bind it to React with `const { useOne, useIds, useAll } = useEntity(store)`, or use the
> standalone `useEntityOne(store, id)` / `useEntityIds(store)` / `useEntityAll(store)` hooks.

Runnable example: [examples/react](../../examples/react).
