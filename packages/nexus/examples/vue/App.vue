<script setup lang="ts">
import { provideStore } from '@plitzi/nexus/vue';

import { appStore, useStore, useStoreValue } from './store';

// Provide the store to descendants (the Vue equivalent of <StoreProvider>). Children can then drop the explicit
// `{ store }` argument. Here we also pass it explicitly for clarity.
provideStore(appStore);

// Two-way binding: `count.value = …` (or v-model) writes back to the store.
const count = useStore('count', { store: appStore });
// Read-only reactive view.
const name = useStoreValue('user.name', { store: appStore });
</script>

<template>
  <div>
    <p>Hello {{ name }}</p>
    <button @click="count--">-</button>
    <input v-model.number="count" />
    <button @click="count++">+</button>
  </div>
</template>
