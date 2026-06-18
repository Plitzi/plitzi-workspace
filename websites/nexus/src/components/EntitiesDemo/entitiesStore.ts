import { createEntityStore } from '@plitzi/nexus';

export type Task = { id: string; text: string; done: boolean };

// A single reactive collection. No provider needed — a row subscribes to its own id via `useOne`, so toggling one
// task re-renders only that row, not the list.
export const tasksStore = createEntityStore<Task>([
  { id: 't1', text: 'Wire up the store', done: true },
  { id: 't2', text: 'Normalize the data', done: false },
  { id: 't3', text: 'Ship it', done: false }
]);
