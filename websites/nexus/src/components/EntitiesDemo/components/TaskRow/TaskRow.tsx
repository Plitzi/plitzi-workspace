import { useRef } from 'react';

import { tasksStore } from '../../entitiesStore';

type TaskRowProps = { id: string };

// Subscribes to a single task via `useOne(id)`, so toggling another row never re-renders this one. The render badge
// makes that visible: only the row you touch ticks up.
const TaskRow = ({ id }: TaskRowProps) => {
  const task = tasksStore.useOne(id);
  const renders = useRef(0);
  renders.current++;

  if (!task) {
    return null;
  }

  return (
    <li className="flex items-center gap-2 rounded-md border border-ink-800 bg-ink-900/60 px-3 py-2">
      <input
        type="checkbox"
        checked={task.done}
        onChange={() => tasksStore.updateOne(id, { done: !task.done })}
        className="accent-brand-500"
      />
      <span className={`flex-1 text-sm ${task.done ? 'text-zinc-600 line-through' : 'text-white'}`}>{task.text}</span>
      <span className="font-mono text-[10px] text-zinc-600" title="renders of this row">
        ×{renders.current}
      </span>
      <button onClick={() => tasksStore.removeOne(id)} className="text-xs text-zinc-600 transition hover:text-red-400">
        remove
      </button>
    </li>
  );
};

export default TaskRow;
