import CodeBlock from '../../../CodeBlock';

const VueGuide = () => (
  <>
    <h2>Vue 3</h2>
    <p>
      Vue bindings live in <code>@plitzi/nexus/vue</code>: <code>provide</code>/<code>inject</code> for distribution and
      composables that return Vue refs, so store paths drive reactivity (and <code>v-model</code>).
    </p>
    <CodeBlock language="bash" code={`npm install @plitzi/nexus   # peer: vue@^3.4`} />

    <CodeBlock
      code={`// store.ts
import { createStore } from '@plitzi/nexus';
import { createStoreComposable } from '@plitzi/nexus/vue';

export type AppState = { count: number; user: { name: string } };

export const appStore = createStore<AppState>(() => ({ count: 0, user: { name: 'Ada' } }));
export const { useStore, useStoreValue } = createStoreComposable<AppState>();`}
    />
    <CodeBlock
      language="markup"
      code={`<!-- App.vue -->
<script setup lang="ts">
import { provideStore } from '@plitzi/nexus/vue';
import { appStore, useStore } from './store';

provideStore(appStore);
const count = useStore('count'); // WritableComputedRef — works with v-model
</script>

<template>
  <button @click="count--">-</button>
  <input v-model.number="count" />
  <button @click="count++">+</button>
</template>`}
    />
    <p>
      Also available: <code>useStoreValue</code> (read-only), <code>useEntity</code>, <code>useDerived</code>,{' '}
      <code>useAsync</code>, <code>useStoreHistory</code>. Every subscribing composable cleans up on{' '}
      <code>onScopeDispose</code>.
    </p>
  </>
);

export default VueGuide;
