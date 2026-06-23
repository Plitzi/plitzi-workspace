import { useCallback, useRef, useState } from 'react';
import { useEntityIds } from '@plitzi/nexus/react';

import TaskRow from '../TaskRow';
import TaskStats from '../TaskStats';
import { tasksStore } from '../../entitiesStore';

const TaskList = () => {
  const ids = useEntityIds(tasksStore);
  const [text, setText] = useState('');
  const nextId = useRef(4);

  const handleAdd = useCallback(() => {
    const value = text.trim();
    if (!value) {
      return;
    }

    const id = `t${nextId.current++}`;
    tasksStore.setOne({ id, text: value, done: false });
    setText('');
  }, [text]);

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
        {ids.map(id => (
          <TaskRow key={id} id={id} />
        ))}
      </ul>

      <TaskStats />
    </div>
  );
};

export default TaskList;
