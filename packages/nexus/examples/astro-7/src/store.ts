// Module-level singleton: the ONLY way to share state across Astro islands, because React Context does not cross
// island boundaries. Every island imports this same `appStore` and reads/writes it directly.
import { createStore } from '@plitzi/nexus';

export type AppState = { count: number };

export const appStore = createStore<AppState>(() => ({ count: 0 }));
