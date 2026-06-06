import { useCallback } from 'react';

import { useTodoSetter } from '../../todoStore';

export type TodoItemProps = {
  id: string;
  text: string;
  done: boolean;
};

const TodoItem = ({ id, text, done }: TodoItemProps) => {
  const setState = useTodoSetter();

  const handleToggle = useCallback(
    () => setState('todos', list => list.map(todo => (todo.id === id ? { ...todo, done: !todo.done } : todo))),
    [setState, id]
  );

  const handleRemove = useCallback(
    () => setState('todos', list => list.filter(todo => todo.id !== id)),
    [setState, id]
  );

  return (
    <li className="flex items-center gap-3 border-b border-ink-800 py-2 last:border-0">
      <input
        type="checkbox"
        checked={done}
        onChange={handleToggle}
        className="h-4 w-4 shrink-0 accent-brand-500"
      />
      <span className={`flex-1 truncate text-sm ${done ? 'text-zinc-600 line-through' : 'text-zinc-200'}`}>
        {text}
      </span>
      <button
        onClick={handleRemove}
        className="shrink-0 rounded-md px-2 text-zinc-600 transition hover:text-red-400"
      >
        ×
      </button>
    </li>
  );
};

export default TodoItem;
