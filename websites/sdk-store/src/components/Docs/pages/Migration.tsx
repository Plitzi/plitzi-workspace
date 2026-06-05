import CodeBlock from '../../CodeBlock';
import Prose from '../Prose';

const Migration = () => (
  <Prose>
    <p>
      Coming from another state library? The mental-model shifts are small. The big one:{' '}
      <strong>you subscribe to a path, not a selector</strong> — so most “select this slice” boilerplate disappears.
    </p>

    <h2>From Zustand</h2>
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
        Need actions co-located? Keep them in the initializer:{' '}
        <code>createStore((set, get) =&gt; (&#123; … &#125;))</code>.
      </li>
      <li>
        <code>persist</code> / <code>devtools</code> middleware → <code>persistMiddleware</code> /{' '}
        <code>reduxDevToolsMiddleware</code> in the <code>middlewares</code> array.
      </li>
    </ul>

    <h2>From Redux / Redux Toolkit</h2>
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
      </tbody>
    </table>
    <p>
      Need the redux-style “intercept and veto a write”? That’s <code>beforeChange</code> returning <code>CANCEL</code>{' '}
      — see the <a href="#/docs/api">API reference</a>.
    </p>

    <h2>From Jotai / Valtio</h2>
    <p>
      Atom/proxy stores give you granular reads for free. sdk-store gets the same granularity from{' '}
      <strong>paths into one tree</strong> instead of many atoms or a mutable proxy — so there’s a single source of
      truth, structural-sharing immutability, and built-in time-travel.
    </p>
    <ul>
      <li>
        Jotai <code>atom</code> + <code>useAtom</code> → a path + <code>useStore('path')</code>. A{' '}
        <strong>derived atom</strong> → <code>createDerived</code>.
      </li>
      <li>
        Valtio <code>proxy</code> + <code>useSnapshot</code> → the store + <code>useStore</code>. Instead of mutating
        the proxy, write with <code>setState</code> (immutable, so time-travel and history just work).
      </li>
    </ul>

    <h2>General checklist</h2>
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
