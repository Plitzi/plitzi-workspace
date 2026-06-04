// The store code equivalent to each live panel, shown via the panel's "Code" toggle.

export const CONTROLS_CODE = `const { useStore } = createStoreHook<State>();

function Controls() {
  const [count, setCount] = useStore('count');
  const [name, setName] = useStore('user.name');
  const [theme, setTheme] = useStore('theme');

  return (
    <>
      <button onClick={() => setCount(c => c - 1)}>−</button>
      <span>{count}</span>
      <button onClick={() => setCount(c => c + 1)}>+</button>

      <input value={name} onChange={e => setName(e.target.value)} />

      <button onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}>
        {theme}
      </button>
    </>
  );
}`;

export const STATE_CODE = `const { useStore } = createStoreHook<State>();

function StateView() {
  // No path → the full reactive state. Re-renders on any change
  // (uses a shallow-equal guard to skip no-ops).
  const [state] = useStore();

  return <pre>{JSON.stringify(state, null, 2)}</pre>;
}`;

export const HISTORY_CODE = `import { useStoreHistory } from '@plitzi/sdk-store';

function History() {
  const { entries, index, canUndo, canRedo, undo, redo, travelTo } =
    useStoreHistory<State>();

  return (
    <>
      <button disabled={!canUndo} onClick={undo}>Undo</button>
      <button disabled={!canRedo} onClick={redo}>Redo</button>

      {entries.map((entry, i) => (
        <button key={i} onClick={() => travelTo(i)} data-active={i === index}>
          {entry.path} = {String(entry.value)}
        </button>
      ))}
    </>
  );
}`;

export const SYNC_CODE = `const { useStoreSync, useStore } = createStoreHook<State>();

function Sync() {
  const [external, setExternal] = useState(50);

  // Write-only: mirror the external value INTO the store on
  // every render. No setter call, no subscription.
  useStoreSync('synced', external);

  const [stored] = useStore('synced'); // read it back, reactively

  return (
    <input
      type="range"
      value={external}
      onChange={e => setExternal(Number(e.target.value))}
    />
  );
}`;

export const GETTER_CODE = `const { useStoreGetter } = createStoreHook<State>();

function ReadOnDemand() {
  // Non-reactive: a STABLE getter. This component never
  // re-renders when 'count' changes — it reads on demand.
  const get = useStoreGetter();

  return (
    <button onClick={() => alert(get('count'))}>
      read count now
    </button>
  );
}`;

export const SETTER_CODE = `const { useStoreSetter } = createStoreHook<State>();

function Toolbar() {
  // Non-reactive: a STABLE setter. Writing never re-renders
  // this component (it doesn't subscribe to anything).
  const setState = useStoreSetter();

  return (
    <>
      <button onClick={() => setState('count', n => n + 1)}>count +1</button>
      <button onClick={() => setState('user.name', 'Zoe')}>name = Zoe</button>
    </>
  );
}`;

export const DERIVED_CODE = `const { useStore } = createStoreHook<State>();

function Derived() {
  // Transformer — memoized, no extra re-renders
  const [upper] = useStore('user.name', {
    transformer: name => name.toUpperCase()
  });

  // Multi-path read + transformer
  const [combined] = useStore(['user.name', 'count'], {
    transformer: ([name, count]) => \`\${name} · \${count}\`
  });

  return <span>{upper} — {combined}</span>;
}`;

export const SCOPED_CODE = `import { StoreProvider } from '@plitzi/sdk-store';

// Both children seed their own \`theme\` (autoSync={false} so the
// local write sticks). 'live' inherits user.name & count from the
// root; 'snapshot' freezes a copy taken at mount.
<>
  <StoreProvider inherit="live" value={{ theme: 'light' }} autoSync={false}>
    <ScopedChild />
  </StoreProvider>
  <StoreProvider inherit="snapshot" value={{ theme: 'light' }} autoSync={false}>
    <ScopedChild />
  </StoreProvider>
</>

function ScopedChild() {
  const [name] = useStore('user.name');         // inherited (live follows root)
  const [theme, setTheme] = useStore('theme');  // own → local, shadows the root

  return (
    <button onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}>
      {name} · {theme}
    </button>
  );
}`;
