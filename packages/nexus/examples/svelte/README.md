# Svelte example (core only, no React)

Svelte's store contract is just `{ subscribe(run) }`. [`nexusStore.ts`](./nexusStore.ts) adapts a Nexus core store
to it using **only** `@plitzi/nexus` — proving the core is React-free.

```svelte
<script lang="ts">
  import { createStore } from '@plitzi/nexus';
  import { nexusStore } from './nexusStore';

  const store = createStore(() => ({ count: 0 }));
  const count = nexusStore(store, s => s.count);
</script>

<button on:click={() => store.set('count', $count + 1)}>{$count}</button>
```
