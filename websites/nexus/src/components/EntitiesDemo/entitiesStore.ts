import { createEntityAdapter, createStoreHook } from '@plitzi/nexus';

export type Task = { id: string; text: string; done: boolean };
export type EntitiesState = { tasks: Record<string, Task> };

export const tasksAdapter = createEntityAdapter<Task>();

export const ENTITIES_INITIAL: EntitiesState = {
  tasks: {
    t1: { id: 't1', text: 'Wire up the store', done: true },
    t2: { id: 't2', text: 'Normalize the data', done: false },
    t3: { id: 't3', text: 'Ship it', done: false }
  }
};

export const { useStore: useTasks, useStoreSetter: useTasksSetter } = createStoreHook<EntitiesState>();
