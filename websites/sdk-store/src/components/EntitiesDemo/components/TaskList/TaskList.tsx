import { useCallback, useRef, useState } from 'react';

import { tasksAdapter, useTasks, useTasksSetter } from '../../entitiesStore';

const TaskList = () => {
  const [tasks] = useTasks('tasks');
  const setState = useTasksSetter();
  const [text, setText] = useState('');
  const nextId = useRef(4);

  const all = tasksAdapter.selectAll(tasks);
  const remaining = all.filter(task => !task.done).length;

  const handleAdd = useCallback(() => {
    const value = text.trim();
    if (!value) {
      return;
    }

    const id = `t${nextId.current++}`;
    setState('tasks', tasksAdapter.addOne({ id, text: value, done: false }));
    setText('');
  }, [text, setState]);

  const handleToggle = useCallback(
    (id: string, done: boolean) => setState('tasks', tasksAdapter.updateOne({ id, changes: { done: !done } })),
    [setState]
  );

  const handleRemove = useCallback((id: string) => setState('tasks', tasksAdapter.removeOne(id)), [setState]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={text}
          onChange={event => setText(event.target.value)}
          onKeyDown={event => event.key === 'Enter' && handleAdd()}
          placeholder="Add a task…"
          className="min-w-0 flex-1 rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-brand-500"
        />
        <button
          onClick={handleAdd}
          className="shrink-0 rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-brand-500 hover:text-white"
        >
          Add
        </button>
      </div>

      <ul className="space-y-1.5">
        {all.map(task => (
          <li key={task.id} className="flex items-center gap-2 rounded-md border border-ink-800 bg-ink-900/60 px-3 py-2">
            <input
              type="checkbox"
              checked={task.done}
              onChange={() => handleToggle(task.id, task.done)}
              className="accent-brand-500"
            />
            <span className={`flex-1 text-sm ${task.done ? 'text-zinc-600 line-through' : 'text-white'}`}>
              {task.text}
            </span>
            <button
              onClick={() => handleRemove(task.id)}
              className="text-xs text-zinc-600 transition hover:text-red-400"
            >
              remove
            </button>
          </li>
        ))}
      </ul>

      <p className="font-mono text-xs text-zinc-500">
        adapter.selectTotal = <span className="text-brand-300">{tasksAdapter.selectTotal(tasks)}</span> · {remaining}{' '}
        remaining
      </p>
    </div>
  );
};

export default TaskList;
