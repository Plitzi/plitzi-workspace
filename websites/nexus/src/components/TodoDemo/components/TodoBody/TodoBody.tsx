import { useCallback, useMemo, useState } from 'react';

import { useTodo, useTodoSetter } from '../../todoStore';
import FilterTab from '../FilterTab';
import TodoItem from '../TodoItem';

import type { TodoFilter } from '../../todoStore';
import type { ChangeEvent, KeyboardEvent } from 'react';

const FILTERS: TodoFilter[] = ['all', 'active', 'done'];

const TodoBody = () => {
  const [todos] = useTodo('todos');
  const [filter, setFilter] = useTodo('filter');
  const setState = useTodoSetter();
  const [draft, setDraft] = useState('');

  const handleDraftChange = useCallback((event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value), []);

  const handleAdd = useCallback(() => {
    const text = draft.trim();
    if (!text) {
      return;
    }

    setState('todos', list => [...list, { id: crypto.randomUUID(), text, done: false }]);
    setDraft('');
  }, [draft, setState]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        handleAdd();
      }
    },
    [handleAdd]
  );

  const handleClearDone = useCallback(() => setState('todos', list => list.filter(todo => !todo.done)), [setState]);

  const visible = useMemo(
    () => todos.filter(todo => (filter === 'all' ? true : filter === 'done' ? todo.done : !todo.done)),
    [todos, filter]
  );
  const remaining = useMemo(() => todos.filter(todo => !todo.done).length, [todos]);

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={handleDraftChange}
          onKeyDown={handleKeyDown}
          placeholder="Add a task and press Enter…"
          className="flex-1 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-brand-500"
        />
        <button
          onClick={handleAdd}
          className="rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-500"
        >
          Add
        </button>
      </div>

      <div className="mt-3 flex gap-1 rounded-lg border border-ink-700 bg-ink-900/60 p-1">
        {FILTERS.map(value => (
          <FilterTab key={value} value={value} active={filter === value} onSelect={setFilter} />
        ))}
      </div>

      <ul className="mt-3 min-h-12">
        {visible.length === 0 && <li className="py-4 text-center text-xs text-zinc-600">Nothing here</li>}
        {visible.map(todo => (
          <TodoItem key={todo.id} id={todo.id} text={todo.text} done={todo.done} />
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
        <span>{remaining} left</span>
        <button onClick={handleClearDone} className="transition hover:text-white">
          Clear completed
        </button>
      </div>
    </div>
  );
};

export default TodoBody;
