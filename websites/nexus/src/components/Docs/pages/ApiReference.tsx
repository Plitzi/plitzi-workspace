import CodeBlock from '../../CodeBlock';
import Prose from '../Prose';

const ApiReference = () => (
  <Prose>
    <p>
      Every public export of <code>@plitzi/nexus</code>, grouped by area. Types are written in TypeScript shorthand;
      <code>P</code> is a dot-path of <code>T</code> and <code>PathValue&lt;T, P&gt;</code> is the value at that path.
    </p>

    <h2>createStore</h2>
    <CodeBlock
      code={`createStore<T>(
  initial: Partial<T> | ((set, get) => Partial<T>),
  options?: { parent?: StoreApi<T>; middlewares?: StoreMiddleware<T>[] }
): StoreApi<T>`}
    />
    <p>
      Creates a store. Pass an initial object or an initializer <code>(set, get) =&gt; state</code>. <code>parent</code>{' '}
      makes a scoped store (reads fall through, writes target the owner); <code>middlewares</code> attaches logger /
      persist / history / your own.
    </p>

    <h3>StoreApi&lt;T&gt;</h3>
    <table>
      <thead>
        <tr>
          <th>Member</th>
          <th>Signature</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <code>getState</code>
          </td>
          <td>
            <code>() =&gt; T</code>
          </td>
          <td>The full merged state (immutable snapshot).</td>
        </tr>
        <tr>
          <td>
            <code>getPath</code>
          </td>
          <td>
            <code>(p: P) =&gt; PathValue&lt;T, P&gt;</code>
          </td>
          <td>Resolves one path through the scope chain, no full merge.</td>
        </tr>
        <tr>
          <td>
            <code>setState</code>
          </td>
          <td>
            <code>(p, value | (prev =&gt; value)) =&gt; void</code>
          </td>
          <td>
            Write a path. <code>setState(undefined, partial)</code> merges the whole state.
          </td>
        </tr>
        <tr>
          <td>
            <code>batch</code>
          </td>
          <td>
            <code>(fn) =&gt; R</code>
          </td>
          <td>Coalesce many writes into one wake pass. Nestable.</td>
        </tr>
        <tr>
          <td>
            <code>subscribe</code>
          </td>
          <td>
            <code>(listener) =&gt; () =&gt; void</code>
          </td>
          <td>Fires on every change. Returns an unsubscribe.</td>
        </tr>
        <tr>
          <td>
            <code>subscribePath</code>
          </td>
          <td>
            <code>(p, listener) =&gt; () =&gt; void</code>
          </td>
          <td>Fires only when that path’s value changes.</td>
        </tr>
        <tr>
          <td>
            <code>subscribeChange</code>
          </td>
          <td>
            <code>(listener) =&gt; () =&gt; void</code>
          </td>
          <td>
            Observe committed <code>&#123; path, prev, next &#125;</code>. The substrate middlewares ride.
          </td>
        </tr>
        <tr>
          <td>
            <code>destroy</code>
          </td>
          <td>
            <code>() =&gt; void</code>
          </td>
          <td>Detach a scoped store from its parent and clear listeners.</td>
        </tr>
      </tbody>
    </table>

    <h2>createStoreHook</h2>
    <p>Binds your state type once and returns the four typed hooks. Call it at module level and export the result.</p>
    <CodeBlock
      code={`const { useStore, useStoreSync, useStoreGetter, useStoreSetter } =
  createStoreHook<T>();`}
    />

    <h3>useStore</h3>
    <CodeBlock
      code={`// Single path → [value, setValue]
const [name, setName] = useStore('user.name');

// Multi-path → [values, ...setters]
const [[name, count], setName, setCount] = useStore(['user.name', 'count']);

// Dynamic path from current state
const [v] = useStore(s => \`style.\${s.mode}\` as PathOf<State>);

// Transformer (memoized) + default value
const [upper] = useStore('user.name', { transformer: v => v.toUpperCase() });
const [el] = useStore(\`items.\${id}\` as PathOf<State>, { defaultValue: {} });`}
    />

    <h3>useStoreSync · useStoreGetter · useStoreSetter</h3>
    <table>
      <thead>
        <tr>
          <th>Hook</th>
          <th>Purpose</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <code>useStoreSync(path, value, opts?)</code>
          </td>
          <td>Push an external value (props) INTO the store. Write-only, no subscription.</td>
        </tr>
        <tr>
          <td>
            <code>useStoreGetter(basePath?, opts?)</code>
          </td>
          <td>A stable getter that reads current values at call time — never triggers a re-render.</td>
        </tr>
        <tr>
          <td>
            <code>useStoreSetter(basePath?, opts?)</code>
          </td>
          <td>A stable setter — write without subscribing (no re-render on change).</td>
        </tr>
        <tr>
          <td>
            <code>useStoreById(id?)</code>
          </td>
          <td>
            Get a named ancestor store’s <code>StoreApi</code> by <code>id</code> (reachable across disconnected
            providers). See <em>Named stores</em> below.
          </td>
        </tr>
      </tbody>
    </table>
    <p>
      Every reactive/imperative hook also accepts <code>{'{ store }'}</code> or <code>{'{ storeId }'}</code> in its
      options to target a specific store instead of the nearest provider — see <em>Named stores</em>.
    </p>

    <h2>StoreProvider</h2>
    <CodeBlock
      code={`<StoreProvider value={initial}>...</StoreProvider>          // create a store
<StoreProvider store={existingStore}>...</StoreProvider>     // provide one
<StoreProvider id="root" value={initial}>...</StoreProvider>  // name it (reach by id)
<StoreProvider path="schema" value={slice}>...</StoreProvider> // sync a sub-path from props
<StoreProvider inherit="live" value={{...}}>...</StoreProvider> // scoped child (live | snapshot)
<StoreProvider value={initial} middlewares={[persistMiddleware({ key: 'app' })]}>...</StoreProvider>`}
    />

    <h2>Named stores (id / storeId)</h2>
    <p>
      Give a provider an <code>id</code> and any descendant can target that store — even across a{' '}
      <em>disconnected</em> (<code>inherit</code>-less) provider that would otherwise shadow it. The id lives in a
      context-scoped registry, so it stops resolving the moment its provider unmounts — no globals, nothing to clean up.
    </p>
    <CodeBlock
      code={`<StoreProvider id="root" value={rootState}>
  <StoreProvider value={{ local: 1 }}>   {/* disconnected — no inherit */}
    <Leaf />
  </StoreProvider>
</StoreProvider>

// The { storeId } option works on every hook — resolved past the disconnect:
const [theme, setTheme] = useStore('theme', { storeId: 'root' }); // reactive
const getUser = useStoreGetter('user', { storeId: 'root' });      // imperative read
const setUser = useStoreSetter('user', { storeId: 'root' });      // imperative write

// useStoreById(id?) returns the raw StoreApi (getState / getPath / setState).
// With no id, it returns the nearest provider's store.
const rootStore = useStoreById<State>('root');
rootStore.id; // 'root' — the identity is also set on the store (logging/devtools)`}
    />
    <p>
      An explicit <code>store</code> option still wins over <code>storeId</code>. Registering an id that shadows an
      ancestor with the same id logs a warning in development (stripped in production); the nearer store wins.
    </p>

    <h2>Derived values</h2>
    <CodeBlock
      code={`createDerived(store, deps: Path[], compute, { equalityFn? })
  → { get, subscribe, destroy }

useDerived(derived) // reactive, re-renders only when the result changes`}
    />
    <p>
      A memoized value computed from store paths (the store’s answer to reselect / Jotai derived atoms). Recomputes when
      a dep changes; only wakes subscribers when the <em>result</em> changes.
    </p>

    <h2>Async &amp; Suspense</h2>
    <CodeBlock
      code={`createAsync(store, path, fetcher, { immediate? })
  → { get, run, subscribe, suspend, destroy }

useAsync(resource)       // { status, data, error, run } — inline loading/error UI
useAsyncValue(resource)  // Suspense: throws the promise / error, returns data`}
    />
    <p>
      <code>createAsync</code> runs a fetch and writes the result straight into the store <code>path</code>, so path
      subscriptions, derived values and persistence all see it.
    </p>

    <h2>Entity adapter</h2>
    <CodeBlock
      code={`const adapter = createEntityAdapter<Item>({ selectId, sortComparer });

// Updaters return (map) => map for setState(path, updater):
store.setState('items', adapter.addOne(item));
store.setState('items', adapter.upsertMany(items));
store.setState('items', adapter.removeOne(id));

// Selectors over the Record<id, Item> map:
adapter.selectAll(map); adapter.selectById(map, id); adapter.selectTotal(map);`}
    />

    <h2>Middleware</h2>
    <p>
      A middleware is <code>(api) =&gt; &#123; beforeChange?, onChange? &#125; | void</code>. <code>onChange</code>{' '}
      observes each committed <code>&#123; path, prev, next &#125;</code>; <code>beforeChange</code> runs before a write
      commits and can transform the value or return <code>CANCEL</code> to block it.
    </p>
    <table>
      <thead>
        <tr>
          <th>Export</th>
          <th>What it does</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <code>loggerMiddleware(opts?)</code>
          </td>
          <td>
            Logs every change. Pass a sink fn or <code>&#123; filter, sink &#125;</code>.
          </td>
        </tr>
        <tr>
          <td>
            <code>persistMiddleware(opts)</code>
          </td>
          <td>
            Mirror to storage + rehydrate. <code>key, storage, partialize, version, migrate, merge, debounce</code>.
          </td>
        </tr>
        <tr>
          <td>
            <code>historyMiddleware(opts?)</code>
          </td>
          <td>
            Records the time-travel action log. Read it with <code>useStoreHistory</code>.
          </td>
        </tr>
        <tr>
          <td>
            <code>reduxDevToolsMiddleware(opts?)</code>
          </td>
          <td>Connect to the Redux DevTools extension (actions + time-travel). No-op without it.</td>
        </tr>
        <tr>
          <td>
            <code>cascade(middleware)</code>
          </td>
          <td>Marks a middleware so nested providers inherit it.</td>
        </tr>
      </tbody>
    </table>
    <CodeBlock
      code={`import { createStore, CANCEL } from '@plitzi/nexus';

// Your own middleware — intercept, transform or cancel writes:
const guard = api => ({
  beforeChange: ({ path, value }) => {
    if (path === 'role' && !isAdmin) return CANCEL;
    if (path === 'qty') return Math.min(value, 10);
    return undefined; // pass through unchanged
  },
  onChange: ({ path, next }) => track(path)
});

createStore(initial, { middlewares: [guard] });`}
    />

    <h2>Time-travel / history</h2>
    <CodeBlock
      code={`createStore(initial, { middlewares: [historyMiddleware({ limit, path, shouldRecord })] });

// In a component:
const { entries, index, canUndo, canRedo, undo, redo, travelTo, clear } =
  useStoreHistory<State>();

// Imperatively (or undefined when historyMiddleware isn't added):
const history = getStoreHistory(store);`}
    />
    <p>
      History is only recorded when <code>historyMiddleware()</code> is on the store. Without it,{' '}
      <code>useStoreHistory</code> returns an empty, no-op view (and warns in development).
    </p>

    <h2>Key types</h2>
    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Shape</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <code>PathOf&lt;T&gt;</code>
          </td>
          <td>Union of all valid dot-paths in T.</td>
        </tr>
        <tr>
          <td>
            <code>PathValue&lt;T, P&gt;</code>
          </td>
          <td>Value type at path P.</td>
        </tr>
        <tr>
          <td>
            <code>StoreChange&lt;T&gt;</code>
          </td>
          <td>
            <code>&#123; path, prev, next &#125;</code> — onChange / subscribeChange payload.
          </td>
        </tr>
        <tr>
          <td>
            <code>WriteContext&lt;T&gt;</code>
          </td>
          <td>
            <code>&#123; path, value, prev &#125;</code> — beforeChange payload.
          </td>
        </tr>
        <tr>
          <td>
            <code>StoreMiddleware&lt;T&gt;</code>
          </td>
          <td>
            <code>(api) =&gt; &#123; beforeChange?, onChange? &#125; | void</code>
          </td>
        </tr>
      </tbody>
    </table>
  </Prose>
);

export default ApiReference;
