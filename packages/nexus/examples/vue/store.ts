import { createStore } from '@plitzi/nexus';
import { createStoreComposable } from '@plitzi/nexus/vue';

export type AppState = {
  count: number;
  user: { name: string };
};

export const appStore = createStore<AppState>(() => ({ count: 0, user: { name: 'Ada' } }));

// Typed composables bound to AppState — the Vue counterpart of React's createStoreHook.
export const { useStore, useStoreValue } = createStoreComposable<AppState>();
