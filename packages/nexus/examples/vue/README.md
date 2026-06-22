# Vue example (core only, no React)

There is no `@plitzi/nexus/vue` integration yet, so this example talks to the agnostic core directly. That is the
point: [`useNexus.ts`](./useNexus.ts) imports **only** `@plitzi/nexus` and bridges `store.subscribe` /
`store.getState` into a Vue `ref`. No React is pulled into the bundle.

```ts
import { createStore } from '@plitzi/nexus';
import { useNexus } from './useNexus';

const store = createStore(() => ({ count: 0 }));
const count = useNexus(store, s => s.count);
// store.set('count', 1) → `count.value` updates
```

A dedicated `@plitzi/nexus/vue` composable can later wrap exactly this pattern.
