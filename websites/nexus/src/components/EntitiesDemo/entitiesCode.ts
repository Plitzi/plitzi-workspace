export const ENTITIES_CODE = `import { createEntityAdapter, createStoreHook } from '@plitzi/nexus';

type Task = { id: string; text: string; done: boolean };
type State = { tasks: Record<string, Task> };

// One adapter gives CRUD updaters + selectors for the normalized map.
const tasks = createEntityAdapter<Task>();
const { useStore, useStoreSetter } = createStoreHook<State>();

function TaskList() {
  const [map] = useStore('tasks');
  const setState = useStoreSetter();

  const add = (text: string) =>
    setState('tasks', tasks.addOne({ id: uid(), text, done: false }));
  const toggle = (id: string, done: boolean) =>
    setState('tasks', tasks.updateOne({ id, changes: { done: !done } }));
  const remove = (id: string) => setState('tasks', tasks.removeOne(id));

  return (
    <ul>
      {tasks.selectAll(map).map(t => (
        <li key={t.id}>
          <input type="checkbox" checked={t.done} onChange={() => toggle(t.id, t.done)} />
          {t.text}
          <button onClick={() => remove(t.id)}>remove</button>
        </li>
      ))}
      {/* tasks.selectTotal(map) → count */}
    </ul>
  );
}`;
