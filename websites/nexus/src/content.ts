export const REPO_URL = 'https://github.com/Plitzi/plitzi-workspace';
export const STORE_DIR_URL = 'https://github.com/Plitzi/plitzi-workspace/tree/main/packages/nexus';
export const NPM_URL = 'https://www.npmjs.com/package/@plitzi/nexus';
export const INSTALL_COMMAND = 'npm install @plitzi/nexus';

export type NavLink = {
  label: string;
  href: string;
};

export const NAV_LINKS: NavLink[] = [
  { label: 'Features', href: '#features' },
  { label: 'API', href: '#api' },
  { label: 'Live Demo', href: '#demo' },
  { label: 'Examples', href: '#examples' },
  { label: 'Benchmarks', href: '#benchmarks' },
  { label: 'Ecosystem', href: '#ecosystem' }
];

export type Feature = {
  icon: string;
  title: string;
  description: string;
};

export const FEATURES: Feature[] = [
  {
    icon: '🎯',
    title: 'Path-based subscriptions',
    description:
      'Subscribe to a single dot-path and re-render only when that exact value changes — no selector boilerplate. Notifying is O(depth), not O(subscribers), so it scales to millions of watchers.'
  },
  {
    icon: '🛡️',
    title: 'Fully type-safe',
    description:
      'Dot-notation paths are checked against your state type. PathOf<T> and PathValue<T, P> give you autocomplete and compile-time safety end to end.'
  },
  {
    icon: '🪆',
    title: 'Scoped stores',
    description:
      'Nested scopes shadow shared state while reading it live. Reads fall through the chain, writes target the owning scope — no prop-drilling.'
  },
  {
    icon: '⏪',
    title: 'Time-travel & action log',
    description:
      'Opt-in history records every change and lets you undo, redo, and jump to any snapshot — built entirely on the store seams, zero core changes.'
  },
  {
    icon: '🪶',
    title: 'Tiny & zero-config',
    description:
      'Built on React’s own useSyncExternalStore. No providers required for a plain store, no reducers, no actions — just state and paths.'
  },
  {
    icon: '🌐',
    title: 'SSR-ready',
    description:
      'Isomorphic layout effects and snapshot getters make it safe on the server. Works with React 19 and streaming out of the box.'
  },
  {
    icon: '🧮',
    title: 'Derived & computed values',
    description:
      'createDerived computes a value from store paths once, memoized, and only wakes subscribers when the result changes. The store’s answer to reselect / Jotai derived atoms — shared across every consumer.'
  },
  {
    icon: '🔌',
    title: 'Middleware pipeline',
    description:
      'logger, persist and time-travel are all middlewares riding one subscribeChange substrate. Add your own with a single (api) => { onChange } — zero cost on the hot path when none are attached.'
  },
  {
    icon: '🗂️',
    title: 'Normalized entity adapter',
    description:
      'createEntityAdapter gives CRUD updaters (addOne, upsertMany, removeOne…) and selectors for a Record<id, entity> map — RTK’s entity ergonomics, dropped straight into setState.'
  },
  {
    icon: '⚡',
    title: 'Batched updates',
    description:
      'store.batch(fn) coalesces many writes into one wake pass — subscribers, derived values and listeners fire once at the end, not once per write. Reads inside the batch still see each change immediately.'
  },
  {
    icon: '🔄',
    title: 'Async & Suspense',
    description:
      'createAsync runs a fetch and lands the result straight in the store, so path subscriptions, derived values and persistence all see it. useAsync for inline loading/error UI, useAsyncValue to suspend.'
  }
];

export type CodeSample = {
  id: string;
  label: string;
  code: string;
  demoId?: string;
};

export const CODE_SAMPLES: CodeSample[] = [
  {
    id: 'create',
    label: 'createStore',
    code: `import { createStore } from '@plitzi/nexus';

type State = {
  count: number;
  user: { name: string };
};

const store = createStore<State>({
  count: 0,
  user: { name: 'Alice' }
});

// Or with an initializer (set, get) => state:
const store2 = createStore<State>((set, get) => ({
  count: 0,
  user: { name: 'Alice' }
}));

store.getState().user.name;         // 'Alice'
store.getPath('user.name');         // 'Alice' (single path, no merge)
store.setState('user.name', 'Bob'); // typed dot-path write
store.setState('count', n => n + 1); // updater function
const unsub = store.subscribePath('count', () => render());`
  },
  {
    id: 'hook',
    label: 'createStoreHook',
    code: `import { createStoreHook } from '@plitzi/nexus';

// Bind your state type ONCE at module level — every hook is
// fully typed without repeating the generic at each call site.
export const { useStore, useStoreSync, useStoreGetter, useStoreSetter } =
  createStoreHook<State>();

// Now anywhere:
const [name, setName] = useStore('user.name'); // typed as string`
  },
  {
    id: 'provider',
    label: 'StoreProvider',
    code: `import { StoreProvider } from '@plitzi/nexus';

// Wrap your tree — creates a store from the initial value.
<StoreProvider value={{ count: 0, user: { name: 'Alice' } }}>
  <App />
</StoreProvider>

// Provide an existing store instance instead of creating one:
<StoreProvider store={store}>
  <App />
</StoreProvider>

// Continuously sync a sub-path from props:
<StoreProvider path="schema.flat" value={flatMap}>
  <Editor />
</StoreProvider>

// Add middlewares (persist, logger, time-travel) when the
// provider creates the store:
<StoreProvider value={initial} middlewares={[persistMiddleware({ key: 'app' }), historyMiddleware()]}>
  <App />
</StoreProvider>`
  },
  {
    id: 'usestore',
    label: 'useStore',
    code: `const { useStore } = createStoreHook<State>();

function Profile() {
  // Single path — re-renders only when user.name changes
  const [name, setName] = useStore('user.name');

  // Multi-path read + per-path setters
  const [[name2, count], setName2, setCount] = useStore(['user.name', 'count']);

  // Dynamic path resolved from current state
  const [val] = useStore(s => \`style.\${s.displayMode}\` as PathOf<State>);

  // Derived + memoized — no extra re-renders
  const [upper] = useStore('user.name', {
    transformer: value => value.toUpperCase()
  });

  // With a default value
  const [el] = useStore(\`schema.flat.\${id}\` as PathOf<State>, { defaultValue: {} });

  return <input value={name} onChange={e => setName(e.target.value)} />;
}`
  },
  {
    id: 'usestoresync',
    label: 'useStoreSync',
    code: `const { useStoreSync } = createStoreHook<State>();

function Bridge({ schema, style }: Props) {
  // Push an external value INTO the store (write-only, no subscription).
  // Runs on every render by default — keeps the store mirroring props.
  useStoreSync('schema', schema);

  // Sync multiple paths at once
  useStoreSync(['schema', 'style'], [schema, style]);

  // Sync the whole state (merges)
  useStoreSync(undefined, fullState);

  // Options: sync once on mount, or sync during render (no layout effect)
  useStoreSync('schema', schema, { mode: 'mount' });
  useStoreSync('schema', schema, { syncStrategy: 'render' });
  useStoreSync('schema', schema, { enabled: isReady });
}`
  },
  {
    id: 'usestoregetter',
    label: 'useStoreGetter',
    code: `const { useStoreGetter } = createStoreHook<State>();

function Handlers() {
  // Non-reactive: a STABLE getter that reads the current value
  // at call time — never triggers a re-render. Great in callbacks.
  const get = useStoreGetter();

  const onSave = () => {
    const name = get('user.name');      // → string
    const fallback = get('user.name', 'guest'); // → string | 'guest'
    api.save(get());                    // → full State
  };

  // Scoped getter bound to a base path
  const getFlat = useStoreGetter('schema.flat');
  getFlat(id);                          // → schema.flat[id]

  return <button onClick={onSave}>Save</button>;
}`
  },
  {
    id: 'usestoresetter',
    label: 'useStoreSetter',
    code: `const { useStoreSetter } = createStoreHook<State>();

function Toolbar() {
  // Non-reactive: a STABLE setter — no re-render on write.
  const setState = useStoreSetter();

  const onRename = () => setState('user.name', 'Bob');
  const onInc = () => setState('count', n => n + 1);
  const onReplace = () => setState(undefined, freshState);

  // Scoped setter bound to a base path
  const setFlat = useStoreSetter('schema.flat');
  setFlat(id, element);                  // sets schema.flat[id]
  setFlat(\`\${id}.attributes\`, attrs);   // nested write

  return <button onClick={onRename}>Rename</button>;
}`
  },
  {
    id: 'scoped',
    label: 'Scoped stores',
    code: `import { StoreProvider } from '@plitzi/nexus';

// inherit="live" — a live link to the parent. Reads fall
// through, parent updates propagate, writes delegate up to
// the scope that owns the path.
<StoreProvider value={{ user, theme: 'dark' }}>
  <StoreProvider inherit="live" value={{ record }}>
    {/* useStore('user')   → inherited, live (parent edits show up) */}
    {/* useStore('record') → own to this scope                      */}
    <ItemView />
  </StoreProvider>
</StoreProvider>

// Writes walk up to the owning scope automatically:
item.setState('user.name', 'Bob');   // delegates to parent
item.setState('record', next);        // stays local

// inherit="snapshot" — copy the parent once at mount, then
// diverge. Parent updates never reach it: ideal for draft /
// "edit then cancel" editors.
<StoreProvider value={{ user, theme: 'dark' }}>
  <StoreProvider inherit="snapshot">
    {/* useStore('user') → frozen copy from mount; edits stay local */}
    <DraftEditor />
  </StoreProvider>
</StoreProvider>`
  },
  {
    id: 'history',
    label: 'Time-travel',
    code: `import { historyMiddleware, useStoreHistory } from '@plitzi/nexus';

// Add the middleware once; useStoreHistory reads what it records.
const store = createStore<State>(initial, { middlewares: [historyMiddleware()] });

function HistoryPanel() {
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
}`
  },
  {
    id: 'derived',
    label: 'Derived',
    code: `import { createDerived, useDerived } from '@plitzi/nexus';

// What it's for: compute a value FROM the store once, memoized.
// It recomputes only when a dependency path changes, and only
// wakes subscribers when the RESULT changes (reselect / computed).
const total = createDerived(
  store,
  ['items'],                                   // dependency paths (typed)
  ([items]) => Object.values(items)            // compute(values)
    .reduce((sum, i) => sum + i.qty * i.price, 0)
);

total.get();                                   // 0 — current value
const off = total.subscribe(() => render());   // wakes only when total changes

// In React — the computation is SHARED across every consumer:
function CartTotal() {
  const value = useDerived(total);
  return <span>\${value}</span>;
}

// Multiple deps + custom equality:
const ids = createDerived(store, ['items'], ([m]) => Object.keys(m), {
  equalityFn: (a, b) => a.length === b.length && a.every((x, i) => x === b[i])
});`
  },
  {
    id: 'entities',
    label: 'Entities',
    code: `import { createEntityAdapter } from '@plitzi/nexus';

type Todo = { id: string; text: string; done: boolean };

// What it's for: CRUD + selectors for a normalized Record<id, T>
// map, without hand-rolling the spread/merge boilerplate.
const todos = createEntityAdapter<Todo>();

// Each op returns an immutable updater — hand it to setState:
store.setState('todos', todos.addMany([t1, t2]));
store.setState('todos', todos.updateOne({ id: '1', changes: { done: true } }));
store.setState('todos', todos.upsertOne(t3));
store.setState('todos', todos.removeOne('2'));

// Selectors read a map:
const map = store.getPath('todos');
todos.selectAll(map);        // Todo[]
todos.selectById(map, '1');  // Todo | undefined
todos.selectTotal(map);      // number

// Custom id + sort order:
createEntityAdapter<Row>({ selectId: r => r.key, sortComparer: byName });`
  },
  {
    id: 'middleware',
    label: 'Middleware',
    code: `import { createStore, loggerMiddleware, persistMiddleware, historyMiddleware } from '@plitzi/nexus';

// logger, persist and time-travel are all middlewares on ONE
// substrate (subscribeChange). Put persist first so it hydrates
// before the others observe.
const store = createStore<State>(initial, {
  middlewares: [
    persistMiddleware({ key: 'app', partialize: s => ({ user: s.user }), debounce: 200 }),
    historyMiddleware(),                    // getStoreHistory(store) for undo/redo
    loggerMiddleware({ filter: c => c.path !== 'mouse' })
  ]
});

// Write your own — an observer of every committed change:
const analytics = (api) => ({
  onChange: ({ path, prev, next }) => track('store', { path }),
});
createStore<State>(initial, { middlewares: [analytics] });

// Or subscribe imperatively to the same substrate:
store.subscribeChange(({ path, prev, next }) => {});`
  },
  {
    id: 'batch',
    label: 'Batch',
    code: `import { createStore } from '@plitzi/nexus';

const store = createStore<State>(initial);

// Without batch: 3 writes → 3 separate notification passes.
store.setState('user.firstName', 'Ada');
store.setState('user.lastName', 'Lovelace');
store.setState('user.age', 36);

// With batch: 3 writes → ONE wake pass. Every path subscriber,
// derived value and middleware fires once, at the very end.
const result = store.batch(() => {
  store.setState('user.firstName', 'Grace');
  store.setState('user.lastName', 'Hopper');
  store.setState('user.age', 85);

  return store.getState().user;        // batch returns fn's value
});

// Reads inside the batch see each write immediately:
store.batch(() => {
  store.setState('count', 1);
  store.getState().count;              // 1
  store.setState('count', c => c + 10);
  store.getState().count;              // 11
});

// Nestable — only the OUTERMOST batch flushes. Change observers
// (logger / history / persist) still see each write, so undo
// stays granular and persistence debounces as usual.`
  },
  {
    id: 'async',
    label: 'Async',
    code: `import { createAsync, useAsync, useAsyncValue } from '@plitzi/nexus';

type State = { user: User | null };

// Bind a fetch to a store path. The resolved value is WRITTEN to
// state.user — so path subscriptions, derived values and persist
// all see it. Status (idle/pending/success/error) lives on the
// resource. { immediate } kicks off the fetch right away.
const userResource = createAsync(
  store,
  'user',
  (id: string) => fetch(\`/api/users/\${id}\`).then(r => r.json()),
  { immediate: ['42'] }
);

userResource.run('99');   // re-fetch — the latest call wins
userResource.get();       // { status, data, error, isLoading }

// Inline loading / error UI (no Suspense):
function Profile() {
  const { status, data, error } = useAsync(userResource);
  if (status === 'pending') return <Spinner />;
  if (status === 'error')   return <ErrorView err={error} />;

  return <span>{data?.name}</span>;
}

// Or suspend — throws the promise while pending, the error to the
// nearest boundary on failure, returns the value when it's ready:
function ProfileName() {
  const user = useAsyncValue(userResource);

  return <span>{user.name}</span>;
}

<ErrorBoundary>
  <Suspense fallback={<Spinner />}>
    <ProfileName />
  </Suspense>
</ErrorBoundary>`
  }
];

export type ComparisonCell = 'yes' | 'no' | string;

export type ComparisonRow = {
  feature: string;
  values: ComparisonCell[];
};

// Capability comparison (facts, not perf). Columns after the leading feature label.
export const COMPARISON_COLUMNS = [
  '@plitzi/nexus',
  'Zustand',
  'Redux Toolkit',
  'Jotai',
  'MobX',
  'Valtio',
  'Context'
];

// Order of values matches COMPARISON_COLUMNS.
export const COMPARISON_ROWS: ComparisonRow[] = [
  {
    feature: 'Native dot-path subscriptions',
    values: ['yes', 'selectors', 'selectors', 'atoms', 'tracked', 'proxy', 'no']
  },
  { feature: 'Type-safe paths end-to-end', values: ['yes', 'no', 'no', 'no', 'no', 'no', 'no'] },
  { feature: 'Scoped / live child stores', values: ['yes', 'no', 'no', 'partial', 'no', 'no', 'manual'] },
  {
    feature: 'Built-in time-travel / action log',
    values: ['yes', 'middleware', 'devtools', 'no', 'spy', 'util', 'no']
  },
  { feature: 'Composable middleware', values: ['yes', 'yes', 'yes', 'no', 'no', 'no', 'no'] },
  { feature: 'Built-in persistence', values: ['yes', 'middleware', 'redux-persist', 'util', 'manual', 'util', 'no'] },
  { feature: 'Normalized entity adapter', values: ['yes', 'no', 'yes', 'no', 'no', 'no', 'no'] },
  { feature: 'Batched updates (store-level)', values: ['yes', 'react', 'react', 'react', 'action', 'auto', 'react'] },
  { feature: 'Async + Suspense built-in', values: ['yes', 'manual', 'rtk-query', 'atoms', 'manual', 'util', 'no'] },
  { feature: 'Single immutable tree (snapshots)', values: ['yes', 'yes', 'yes', 'no', 'no', 'no', 'yes'] },
  { feature: 'Plain objects (no proxy / classes)', values: ['yes', 'yes', 'yes', 'yes', 'no', 'no', 'yes'] },
  { feature: 'Multi-path read in one hook', values: ['yes', 'manual', 'manual', 'manual', 'auto', 'auto', 'no'] },
  {
    feature: 'Dynamic / computed paths',
    values: ['yes', 'selectors', 'selectors', 'derived', 'computed', 'derive', 'no']
  },
  {
    feature: 'Memoized derived values',
    values: ['yes', 'selectors', 'reselect', 'derived', 'computed', 'derive', 'no']
  },
  { feature: 'No actions / reducers', values: ['yes', 'yes', 'no', 'yes', 'yes', 'yes', 'yes'] },
  { feature: 'Provider optional', values: ['yes', 'yes', 'no', 'partial', 'yes', 'yes', 'no'] },
  { feature: 'Fine-grained by default', values: ['yes', 'opt-in', 'opt-in', 'yes', 'yes', 'yes', 'no'] },
  { feature: 'SSR-ready', values: ['yes', 'yes', 'yes', 'yes', 'yes', 'yes', 'yes'] }
];

export type EcosystemPackage = {
  name: string;
  tagline: string;
  description: string;
  href: string;
};

export const ECOSYSTEM: EcosystemPackage[] = [
  {
    name: '@plitzi/nexus',
    tagline: 'The state core',
    description: 'The type-safe React store you are reading about — the foundation the rest of the SDK builds on.',
    href: STORE_DIR_URL
  },
  {
    name: '@plitzi/sdk-dev-tools',
    tagline: 'Inspect & time-travel',
    description:
      'A devtools panel with Store, Elements, Logs and a History tab — browse the action log and jump to any snapshot of the store.',
    href: 'https://github.com/Plitzi/plitzi-workspace/tree/main/packages/sdk-dev-tools'
  },
  {
    name: '@plitzi/sdk-shared',
    tagline: 'Shared contracts',
    description: 'Shared types and utilities (CommonState, logs, elements) that the store and the platform speak.',
    href: 'https://github.com/Plitzi/plitzi-workspace/tree/main/packages/sdk-shared'
  }
];
