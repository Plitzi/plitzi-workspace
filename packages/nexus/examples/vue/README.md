# Vue example

Uses the first-class Vue integration, `@plitzi/nexus/vue` — provide/inject + composables that return Vue refs.

- [`store.ts`](./store.ts) — creates the agnostic store (`@plitzi/nexus`) and the typed composables
  (`createStoreComposable<AppState>()`).
- [`App.vue`](./App.vue) — `provideStore(store)`, then `useStore('count')` (two-way, works with `v-model`) and
  `useStoreValue('user.name')` (read-only).

```ts
import { createStore } from '@plitzi/nexus';
import { provideStore, useStore } from '@plitzi/nexus/vue';

const store = createStore(() => ({ count: 0 }));
provideStore(store);

const count = useStore('count', { store }); // WritableComputedRef — count.value++ writes to the store
```

| Composable | Returns |
|---|---|
| `provideStore(store)` / `injectStore()` | Provide/inject a store (the `<StoreProvider>` equivalent). |
| `useStore(path, opts?)` | `WritableComputedRef` — two-way binding. |
| `useStoreValue(path?, opts?)` | Read-only `Ref` (whole state when no path). |
| `createStoreComposable<State>()` | Typed `{ useStore, useStoreValue, useStoreState }`. |
| `useEntity` / `useEntityOne` / `useEntityIds` / `useEntityAll` | Reactive entity-store views. |
| `useDerived(derived)` | Reactive `createDerived` value. |
| `useAsync(resource)` | Reactive async snapshot (`status` / `data` / `error`). |
| `useStoreHistory(opts?)` | Reactive undo/redo view (needs `historyMiddleware()`). |
