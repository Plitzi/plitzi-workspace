export const ENTITIES_CODE = `import { createEntityStore } from '@plitzi/nexus';

type Task = { id: string; text: string; done: boolean };

// One reactive collection — O(1) per-item writes, hooks on the store object.
const tasks = createEntityStore<Task>(seed);

function TaskList() {
  const ids = tasks.useIds(); // re-renders only on add/remove

  const add = (text: string) => tasks.setOne({ id: uid(), text, done: false });

  return (
    <ul>
      {ids.map(id => <TaskRow key={id} id={id} />)}
    </ul>
  );
}

function TaskRow({ id }: { id: string }) {
  const task = tasks.useOne(id); // re-renders only when THIS task changes
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
