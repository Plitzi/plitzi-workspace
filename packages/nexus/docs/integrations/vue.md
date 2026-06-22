# Nexus + Vue

First-class Vue 3 bindings from `@plitzi/nexus/vue`: `provide`/`inject` for store distribution and composables that
return Vue refs, so store paths participate in Vue reactivity (and `v-model`). The store itself comes from the
agnostic root `@plitzi/nexus`.

```ts
import { createStore } from '@plitzi/nexus';
import { provideStore, useStore } from '@plitzi/nexus/vue';
```

Install: `vue` is an optional peer dependency (`^3.4`).

## Distribute a store

```vue
<script setup lang="ts">
import { createStore } from '@plitzi/nexus';
import { provideStore } from '@plitzi/nexus/vue';

const store = createStore(() => ({ count: 0, user: { name: 'Ada' } }));
provideStore(store); // descendants can now use the composables without passing { store }
</script>
```

## Composables

| Composable | Returns |
|---|---|
| `provideStore(store)` / `injectStore()` | Provide / inject a store — the `<StoreProvider>` equivalent. |
| `useStore(path, opts?)` | `WritableComputedRef` — two-way; `count.value++` writes to the store, works with `v-model`. |
| `useStoreValue(path?, opts?)` | Read-only `Ref` (whole state when no path). |
| `createStoreComposable<State>()` | Typed `{ useStore, useStoreValue, useStoreState }` (the `createStoreHook` analogue). |
| `useEntity(store)` / `useEntityOne` / `useEntityIds` / `useEntityAll` | Reactive entity-store views. |
| `useDerived(derived)` | Reactive `createDerived` value. |
| `useAsync(resource)` | Reactive async snapshot — branch on `snapshot.value.status`. |
| `useStoreHistory(opts?)` | Reactive undo/redo view (needs `historyMiddleware()`). |

Every composable that subscribes cleans up on `onScopeDispose`, so unmounting a component (or stopping an
`effectScope`) detaches its store subscription automatically.

```vue
<script setup lang="ts">
import { useStore, useStoreValue } from '@plitzi/nexus/vue';

const count = useStore('count');          // writable: v-model / count.value++
const name = useStoreValue('user.name');  // read-only ref
</script>

<template>
  <p>{{ name }}</p>
  <input v-model.number="count" />
</template>
```

Runnable example: [examples/vue](../../examples/vue).
