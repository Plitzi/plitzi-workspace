import CodeBlock from '../../../CodeBlock';

const SvelteGuide = () => (
  <>
    <h2>Svelte</h2>
    <p>
      There is no dedicated Svelte package yet — and none is needed. Svelte's store contract is just{' '}
      <code>{'{ subscribe }'}</code>, so a few lines adapt the agnostic core. No React is pulled in.
    </p>
    <CodeBlock language="bash" code={`npm install @plitzi/nexus`} />

    <CodeBlock
      code={`// nexusStore.ts
import type { StoreApi } from '@plitzi/nexus';

export function nexusStore<TState extends object, V>(store: StoreApi<TState>, select: (s: TState) => V) {
  return {
    subscribe(run: (value: V) => void) {
      run(select(store.getState()));

      return store.subscribe(() => run(select(store.getState())));
    }
  };
}`}
    />
    <CodeBlock
      language="markup"
      code={`<!-- Counter.svelte -->
<script lang="ts">
  import { createStore } from '@plitzi/nexus';
  import { nexusStore } from './nexusStore';

  const store = createStore(() => ({ count: 0 }));
  const count = nexusStore(store, s => s.count);
</script>

<button on:click={() => store.set('count', $count + 1)}>{$count}</button>`}
    />
  </>
);

export default SvelteGuide;
