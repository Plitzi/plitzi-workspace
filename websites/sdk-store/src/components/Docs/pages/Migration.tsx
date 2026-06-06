import CodeBlock from '../../CodeBlock';
import Prose from '../Prose';

const Migration = () => (
  <Prose>
    <p>
      Coming from another state library? The mental-model shifts are small. The big one:{' '}
      <strong>you subscribe to a path, not a selector</strong> — so most “select this slice” boilerplate disappears.
    </p>

    <ul>
      <li><a href="#/docs/migration?anchor=from-zustand">From Zustand</a></li>
      <li><a href="#/docs/migration?anchor=from-redux">From Redux / Redux Toolkit</a></li>
      <li><a href="#/docs/migration?anchor=from-jotai-valtio">From Jotai / Valtio</a></li>
      <li><a href="#/docs/migration?anchor=from-mobx">From MobX</a></li>
      <li><a href="#/docs/migration?anchor=from-context">From React Context</a></li>
      <li><a href="#/docs/migration?anchor=general-checklist">General checklist</a></li>
    </ul>

    <h2 id="from-zustand">From Zustand</h2>
    <p>
      Closest cousin. A Zustand store with a selector becomes a path subscription; actions become plain{' '}
      <code>setState</code> calls (or methods you keep in the initializer).
    </p>
    <CodeBlock
      code={`// Zustand
const useBear = create(set => ({
  bears: 0,
  add: () => set(s => ({ bears: s.bears + 1 }))
}));
const bears = useBear(s => s.bears);
const add = useBear(s => s.add);

// sdk-store
const { useStore } = createStoreHook<{ bears: number }>();
const [bears, setBears] = useStore('bears');
const add = () => setBears(n => n + 1);`}
    />
    <ul>
      <li>
        Selector <code>s =&gt; s.bears</code> → path <code>'bears'</code>. No equality function needed; a path only
        wakes on its own change.
      </li>
      <li>
        Zustand&apos;s <code>set</code> merges at the top level; <code>setState</code> writes a single path (or the full
        state when called without a path) — more granular by default.
      </li>
      <li>
        Need actions co-located? Keep them in the initializer:{' '}
        <code>createStore((set, get) =&gt; (&#123; … &#125;))</code>.
      </li>
      <li>
        Zustand&apos;s <code>persist</code> / <code>devtools</code> middleware →{' '}
        <code>persistMiddleware</code> / <code>reduxDevToolsMiddleware</code> in the{' '}
        <code>middlewares</code> array. Same concepts, different key names.
      </li>
      <li>
        Zustand&apos;s <code>subscribe</code> with a selector → <code>store.subscribePath(path, cb)</code>.
      </li>
    </ul>

    <h2 id="from-redux">From Redux / Redux Toolkit</h2>
    <p>
      Drop the action types, reducers and dispatch. A reducer case becomes a direct, typed write; a{' '}
      <code>createSelector</code> becomes <code>createDerived</code>; an entity slice becomes{' '}
      <code>createEntityAdapter</code>.
    </p>
    <CodeBlock
      code={`// RTK slice
dispatch(counterSlice.actions.incremented());
const count = useSelector(s => s.counter.value);

// sdk-store
const [count, setCount] = useStore('counter.value');
setCount(n => n + 1);`}
    />
    <table>
      <thead>
        <tr>
          <th>Redux</th>
          <th>sdk-store</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <code>useSelector(s =&gt; s.a.b)</code>
          </td>
          <td>
            <code>useStore('a.b')</code>
          </td>
        </tr>
        <tr>
          <td>reducer + dispatch(action)</td>
          <td>
            <code>setState('a.b', value)</code>
          </td>
        </tr>
        <tr>
          <td>
            <code>createSelector</code>
          </td>
          <td>
            <code>createDerived</code> / <code>useDerived</code>
          </td>
        </tr>
        <tr>
          <td>
            <code>createEntityAdapter</code> (RTK)
          </td>
          <td>
            <code>createEntityAdapter</code> (same CRUD ergonomics, plain <code>Record&lt;id, T&gt;</code>)
          </td>
        </tr>
        <tr>
          <td>Redux DevTools</td>
          <td>
            <code>reduxDevToolsMiddleware()</code> (same extension, actions + time-travel)
          </td>
        </tr>
        <tr>
          <td>
            middleware <code>(store) =&gt; next =&gt; action</code>
          </td>
          <td>
            <code>(api) =&gt; &#123; beforeChange?, onChange? &#125;</code>
          </td>
        </tr>
        <tr>
          <td>
            <code>createSlice</code> / <code>createReducer</code>
          </td>
          <td>
            No equivalent needed — <code>setState</code> replaces both. Group related writes with{' '}
            <code>store.batch()</code>.
          </td>
        </tr>
        <tr>
          <td>
            <code>configureStore</code>
          </td>
          <td>
            <code>createStore</code> with <code>middlewares</code> array. One store, one tree.
          </td>
        </tr>
      </tbody>
    </table>
    <p>
      Need the redux-style “intercept and veto a write”? That’s <code>beforeChange</code> returning <code>CANCEL</code>{' '}
      — see the <a href="#/docs/api">API reference</a>.
    </p>

    <h2 id="from-jotai-valtio">From Jotai / Valtio</h2>
    <p>
      Atom/proxy stores give you granular reads for free. sdk-store gets the same granularity from{' '}
      <strong>paths into one tree</strong> instead of many atoms or a mutable proxy — so there’s a single source of
      truth, structural-sharing immutability, and built-in time-travel.
    </p>
    <ul>
      <li>
        Jotai <code>atom(value)</code> + <code>useAtom</code> → a path in the state tree +{' '}
        <code>useStore('path')</code>. One atom per path is replaced by one store containing every path.
      </li>
      <li>
        Jotai <strong>derived atom</strong> (<code>atom(readFn, writeFn?)</code>) →{' '}
        <code>createDerived(store, deps, compute)</code> or a <code>useStore</code> transformer.
      </li>
      <li>
        Jotai <code>atomWithStorage</code> → <code>persistMiddleware</code> on the store (covers the whole tree, not one
        atom at a time).
      </li>
      <li>
        Valtio <code>proxy</code> + <code>useSnapshot</code> → the store + <code>useStore</code>. Instead of mutating
        the proxy directly, write with <code>setState(path, value)</code> (immutable, so time-travel and history just
        work).
      </li>
      <li>
        Valtio&apos;s auto-tracking is implicit; sdk-store is explicit: you declare which paths a component depends on.
        This makes data flow easier to reason about and eliminates whole categories of stale-closure bugs.
      </li>
    </ul>

    <h2 id="from-mobx">From MobX</h2>
    <p>
      MobX uses mutable observables with auto-tracking (<code>@observable</code> / <code>makeAutoObservable</code>) and
      computed values. sdk-store uses an immutable tree with explicit path subscriptions — the same granularity, but
      every value is a plain object, time-travel is free, and there are no decorators or class boilerplate.
    </p>
    <CodeBlock
      code={`// MobX
class Store {
  @observable count = 0;
  @observable user = { name: 'Alice' };
  @computed get greeting() { return \`Hello \${this.user.name}\`; }
  @action increment() { this.count++; }
}

// sdk-store
const store = createStore({ count: 0, user: { name: 'Alice' } });
const greeting = createDerived(store, ['user.name'], ([name]) => \`Hello \${name}\`);
const increment = () => store.setState('count', n => n + 1);`}
    />
    <table>
      <thead>
        <tr>
          <th>MobX</th>
          <th>sdk-store</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <code>@observable</code> / <code>observable()</code>
          </td>
          <td>
            Plain object shape passed to <code>createStore</code>. No decorators.
          </td>
        </tr>
        <tr>
          <td>
            <code>observer(Component)</code>
          </td>
          <td>
            <code>useStore(path)</code> — explicit per-component subscription.
          </td>
        </tr>
        <tr>
          <td>
            <code>@computed</code> / <code>computed()</code>
          </td>
          <td>
            <code>createDerived(store, deps, compute)</code> — memoized, lazy, shared across consumers.
          </td>
        </tr>
        <tr>
          <td>
            <code>@action</code> / <code>runInAction</code>
          </td>
          <td>
            <code>setState(path, value)</code> or <code>store.batch(fn)</code> for multi-write coalescing.
          </td>
        </tr>
        <tr>
          <td>
            <code>autorun</code> / <code>reaction</code>
          </td>
          <td>
            <code>store.subscribePath(path, cb)</code> or <code>store.subscribeChange(cb)</code> for every mutation.
          </td>
        </tr>
        <tr>
          <td>Mutable updates</td>
          <td>
            Immutable structural-sharing — <code>setState</code> produces a new root. Time-travel and undo come for free.
          </td>
        </tr>
      </tbody>
    </table>

    <h2 id="from-context">From React Context (useContext + useReducer)</h2>
    <p>
      React Context + <code>useReducer</code> is the built-in approach, but it has a well-known flaw: every consumer
      re-renders when <em>any</em> part of the context value changes, unless you split values into N contexts or wrap
      every read in <code>useMemo</code>. sdk-store eliminates the problem entirely — a component subscribes to exactly
      the path it needs.
    </p>
    <CodeBlock
      code={`// Context + useReducer
const App = () => (
  <StateProvider>
    <Panel />
  </StateProvider>
);

function Panel() {
  const { state, dispatch } = useContext(StateContext);
  const count = state.count; // re-renders on EVERY state change
  return <span>{count}</span>;
}

// sdk-store
const { useStore } = createStoreHook<State>();

<StoreProvider value={{ count: 0, user: { name: 'Alice' } }}>
  <Panel />
</StoreProvider>

function Panel() {
  const [count] = useStore('count'); // re-renders ONLY when count changes
  return <span>{count}</span>;
}`}
    />
    <table>
      <thead>
        <tr>
          <th>Context + useReducer</th>
          <th>sdk-store</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Multiple <code>Context.Provider</code> to avoid re-renders</td>
          <td>
            Single <code>StoreProvider</code>. Granularity comes from the path, not the provider.
          </td>
        </tr>
        <tr>
          <td>
            <code>useContext(StateContext)</code> reads the whole value
          </td>
          <td>
            <code>useStore('path')</code> reads and subscribes to one path only.
          </td>
        </tr>
        <tr>
          <td>
            <code>useReducer</code> + dispatch + action types
          </td>
          <td>
            <code>setState(path, value)</code> — no action types, no reducer, no dispatch.
          </td>
        </tr>
        <tr>
          <td>
            <code>React.memo</code> everywhere to prevent cascading re-renders
          </td>
          <td>
            No <code>React.memo</code> needed for store subscriptions — paths are already granular.
          </td>
        </tr>
        <tr>
          <td>No time-travel / devtools built-in</td>
          <td>
            <code>historyMiddleware</code> + <code>reduxDevToolsMiddleware</code> — opt in and done.
          </td>
        </tr>
      </tbody>
    </table>

    <h2 id="general-checklist">General checklist</h2>
    <ol>
      <li>Move your state shape into one typed object; reach values by dot-path.</li>
      <li>
        Replace selectors with <code>useStore('path')</code>; replace cross-path computed values with{' '}
        <code>createDerived</code>.
      </li>
      <li>
        Replace actions/reducers with <code>setState</code> (or methods in the initializer).
      </li>
      <li>
        Re-add cross-cutting concerns as middleware: <code>persistMiddleware</code>, <code>loggerMiddleware</code>,{' '}
        <code>historyMiddleware</code>, <code>reduxDevToolsMiddleware</code>, or your own.
      </li>
      <li>
        Wrap large multi-writes in <code>store.batch()</code> if you were relying on a single dispatch before.
      </li>
    </ol>
  </Prose>
);

export default Migration;
