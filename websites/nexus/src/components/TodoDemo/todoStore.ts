import { createStoreHook } from '@plitzi/nexus';

export type Todo = {
  id: string;
  text: string;
  done: boolean;
};

export type TodoFilter = 'all' | 'active' | 'done';

export type TodoState = {
  todos: Todo[];
  filter: TodoFilter;
};

export const TODO_INITIAL: TodoState = {
  todos: [
    { id: 't1', text: 'Learn @plitzi/nexus', done: true },
    { id: 't2', text: 'Subscribe to a single path', done: false },
    { id: 't3', text: 'Ship something great', done: false }
  ],
  filter: 'all'
};

export const { useStore: useTodo, useStoreSetter: useTodoSetter } = createStoreHook<TodoState>();
