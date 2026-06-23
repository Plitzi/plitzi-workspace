export const ENTITIES_CODE = `import { createEntityStore } from '@plitzi/nexus';
import { useEntityOne, useEntityIds } from '@plitzi/nexus/react';

type Task = { id: string; text: string; done: boolean };

// One agnostic reactive collection — O(1) per-item writes. React bindings live in @plitzi/nexus/react.
const tasks = createEntityStore<Task>(seed);

function TaskList() {
  const ids = useEntityIds(tasks); // re-renders only on add/remove

  const add = (text: string) => tasks.setOne({ id: uid(), text, done: false });

  return (
    <ul>
      {ids.map(id => <TaskRow key={id} id={id} />)}
    </ul>
  );
}

function TaskRow({ id }: { id: string }) {
  const task = useEntityOne(tasks, id); // re-renders only when THIS task changes
  if (!task) return null;

  const toggle = () => tasks.updateOne(id, { done: !task.done });
  const remove = () => tasks.removeOne(id);

  return (
    <li>
      <input type="checkbox" checked={task.done} onChange={toggle} />
      {task.text}
      <button onClick={remove}>remove</button>
    </li>
  );
}`;
