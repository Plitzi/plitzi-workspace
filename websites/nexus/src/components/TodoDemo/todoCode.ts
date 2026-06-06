export const TODO_CODE = `const { useStore, useStoreSetter } = createStoreHook<TodoState>();

function Todos() {
  const [todos] = useStore('todos');
  const [filter, setFilter] = useStore('filter');     // typed: 'all' | 'active' | 'done'
  const setState = useStoreSetter();

  const add = (text: string) =>
    setState('todos', list => [...list, { id: uid(), text, done: false }]);

  const remaining = todos.filter(t => !t.done).length;
  const visible = todos.filter(t =>
    filter === 'all' ? true : filter === 'done' ? t.done : !t.done
  );

  return <>{visible.map(t => <Item key={t.id} {...t} />)} <span>{remaining} left</span></>;
}

function Item({ id, text, done }: Todo) {
  const setState = useStoreSetter();
  const toggle = () =>
    setState('todos', list => list.map(t => (t.id === id ? { ...t, done: !t.done } : t)));
  const remove = () => setState('todos', list => list.filter(t => t.id !== id));

  return (
    <li>
      <input type="checkbox" checked={done} onChange={toggle} /> {text}
      <button onClick={remove}>×</button>
    </li>
  );
}`;
