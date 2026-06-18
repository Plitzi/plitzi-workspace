import { tasksStore } from '../../entitiesStore';

// Reads the whole collection via `useAll`, so this footer re-renders on any change (count + remaining). The list rows
// above stay isolated through `useOne`.
const TaskStats = () => {
  const all = tasksStore.useAll();
  const remaining = all.filter(task => !task.done).length;

  return (
    <p className="font-mono text-xs text-zinc-500">
      store.size = <span className="text-brand-300">{all.length}</span> · {remaining} remaining
    </p>
  );
};

export default TaskStats;
