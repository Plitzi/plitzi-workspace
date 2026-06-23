<p align="center">
  <img src="./logo.svg" alt="@plitzi/nexus — one store, every framework" width="640" />
</p>

# @plitzi/nexus

A lightweight, type-safe state store with a **framework-agnostic core** and first-class React bindings, built on `useSyncExternalStore`. You subscribe to **dot-notation paths** and re-render only when that exact value changes — no selectors, no reducers, no action types. On top of that core it ships scoped stores, time-travel, derived values, an entity adapter, and a middleware pipeline (logger / persist / history). Fully compatible with SSR, React Server Components, Next.js App Router, and Astro (6 LTS & 7) islands.

## Entry points

The **package root is the framework-agnostic core** (zero React). Framework bindings live in their own entries.

| Import | What it is |
|---|---|
| `@plitzi/nexus` | **Agnostic core** — `createStore`, imperative `get/set/watch`, middlewares, async/derived/entities. Zero React. |
| `@plitzi/nexus/advanced` | The opt-in add-ons (`async`, `derived`, `entities`, `history`, `middleware`) re-exported in one place, kept off the root so root autocomplete stays focused on the core. |
| `@plitzi/nexus/react` | React bindings — `StoreProvider`, `createStoreHook`, `useStore`, `useStoreHistory`, `useEntity`, `useAsync`, `useDerived`, … |
| `@plitzi/nexus/vue` | Vue 3 bindings — `provideStore`, `useStore` (writable ref), `useStoreValue`, `useEntity`, `useStoreHistory`, … |
| `@plitzi/nexus/next` | Next.js App Router helpers (`bindServerAction`). |
| `@plitzi/nexus/rsc` | Server Component → Client handoff markers (`createServerSnapshot`, `isServerSnapshot`, `stripServerFlag`). Also re-exported from the root. |

Any other framework works by talking to the root directly (`store.subscribe` / `store.getState`) — see the Svelte
[example](./examples/svelte). For Astro, see [docs/integrations/astro.md](./docs/integrations/astro.md).

```bash
npm install @plitzi/nexus   # React bindings peer deps: react@^18 || ^19, react-dom@^18 || ^19
```

```ts
// React: hooks come from the /react entry
import { createStoreHook } from '@plitzi/nexus/react';

type State = { count: number; user: { name: string } };
const { useStore } = createStoreHook<State>();

function Counter() {
  const [count, setCount] = useStore('count'); // typed as number
  return <button onClick={() => setCount(n => n + 1)}>{count}</button>;
}
```

## The whole imperative API in three verbs

Outside React, a store speaks three words. `get`, `set` and `watch` are typed against your state and cover the common case — the longer `getState` / `getPath` / `subscribePath` names stay for advanced reads (default values) and back-compat.

```ts
import { createStore } from '@plitzi/nexus';

const store = createStore<State>({ count: 0, user: { name: 'Carlos' } });

store.get('user.name');                 // 'Carlos'  (one path, no full merge)
store.get();                            // entire state
store.set('user.name', 'Ada');          // typed dot-path write
store.set('count', n => n + 1);         // updater form
const off = store.watch('user.name', name => render(name)); // fires only for this path
```

## What each piece is for

### Core — the 90%

| Import | What it's for |
|---|---|
| `createStore` | Create a vanilla store (no React needed). Exposes `get` / `set` / `watch`. |
| `createStoreHook<T>()` | Bind your state type once → fully-typed `useStore*` hooks. |
| `StoreProvider` | Put a store on React context; optionally scope/sync/record it. |
| `useStore` | Subscribe + write a path (or paths). Re-renders on change only. |

### Advanced — reach for it when you need it

Also importable from the focused `@plitzi/nexus/advanced` entry point, which keeps root autocomplete on the Core.

| Import | What it's for |
|---|---|
| `useStoreSetter` | A stable setter — write without subscribing/re-rendering. |
| `useStoreGetter` | A stable getter — read current values in callbacks, no re-render. |
| `useStoreById` | Get a named ancestor store's `StoreApi` by `id` (reachable across disconnected providers). |
| `useStoreSync` | Mirror an external value (props) **into** the store. |
| `createDerived` / `useDerived` | A memoized value computed from store paths (reselect-style). |
| `createEntityAdapter` / `createEntityStore` | CRUD + selectors for a normalized `Record<id, T>` map; the store variant adds O(1) per-item updates. |
| `createAsync` / `useAsync` / `useAsyncValue` | Race-safe fetch landed on a path; inline UI or Suspense. |
| `loggerMiddleware` / `persistMiddleware` / `historyMiddleware` / `reduxDevToolsMiddleware` | Middlewares: log, persist to storage, record time-travel, connect to Redux DevTools. |
| `getStoreHistory` / `useStoreHistory` | Undo / redo / jump-to-snapshot action log (enabled by `historyMiddleware`). |
| `setCodegenEnabled` | Force on/off the `new Function` codegen path (auto-detects CSP/SSR). |
| `createServerSnapshot` / `isServerSnapshot` | Mark server-fetched data for RSC → Client handoff, and check the marker. |
| `bindServerAction` | Optimistic updates + revalidation for Next.js Server Actions. |

## Architecture

The package root is the **framework-agnostic core**; React, Vue, and Next bindings are physically separate
entries that depend on it (never the other way round), so the core ships zero framework code.

```
src/
  index.ts               agnostic core barrel (createStore, middlewares, async/derived/entities, rsc)
  createStore/           store factory + scope chain / write engine
    createStore.ts         factory (get/set/watch + getState/setState/subscribe…)
    helpers/               writeByPath (codegen), deepMerge, scope reads, PathTrie, Subscribers…
  derived/               createDerived (memoized computed values)
  entities/              createEntityAdapter (map CRUD) + createEntityStore (reactive O(1) per item)
  async/                 createAsync (race-safe fetch landed on a path)
  middleware/            logger / persist / history / reduxDevTools / cascade (all on subscribeChange)
  history/               getStoreHistory (time-travel handle, enabled by historyMiddleware)
  rsc/                   createServerSnapshot / isServerSnapshot / stripServerFlag
  helpers/               getByPath, setByPath, parsePath, shallowEqual, isPathAffected…
  types/                 StoreTypes.ts — every public type
  advanced/              curated barrel re-exporting async + derived + entities + history + middleware
  react/                 StoreProvider, StoreContext, createStoreHook, hooks/* (useStore, useEntity, useAsync…)
  vue/                   provideStore/injectStore + composables (useStore, useEntity, useDerived, useAsync…)
  next/                  bindServerAction (App Router server actions)
```

> **One change substrate.** Every committed write flows through `store.subscribeChange((change) => …)` where `change` is `{ path, prev, next }`. `loggerMiddleware`, `persistMiddleware`, and `historyMiddleware` are all just observers on this channel — and so is any middleware you write. It costs nothing on the hot path when no observer is attached. Writes can also be **intercepted** before they commit via a middleware's `beforeChange` to transform or cancel them — see [Intercepting writes](#intercepting-writes-beforechange).

## `createStore`

```ts
const store = createStore<MyState>({ count: 0, user: { name: 'Alice' } });
// or with an initializer function:
const store = createStore<MyState>((setState, getState) => ({ count: 0 }));

// Scoped store: reads fall through to a parent store (see "Scoped stores" below)
const child = createStore<MyState>({ record }, { parent: rootStore });

// With middlewares (loggerMiddleware / persistMiddleware / historyMiddleware / your own)
const store = createStore<MyState>({ count: 0 }, {
  middlewares: [persistMiddleware({ key: 'app' }), historyMiddleware(), loggerMiddleware()]
});

// With an id, so descendants can target it by id (see "Named stores" below)
const store = createStore<MyState>({ count: 0 }, { id: 'root' });
```

`StoreApi` exposes `getState`, `getPath`, `setState`, `subscribe`, `subscribePath`, `subscribeChange`,
`destroy?()`, and an optional `id`. Call `destroy()` to detach a scoped store from its parent and clear its
listeners (prevents leaks for short-lived scopes like list items). `StoreProvider` calls it automatically on
unmount.

## `StoreProvider`

Wraps children with a store context. Creates a new store by default; pass `store` to provide an existing one.

```tsx
<StoreProvider value={{ count: 0 }}>
  <App />
</StoreProvider>

// Inherit from the parent — two modes via the `inherit` prop:
<StoreProvider inherit="snapshot" value={{ extra: true }}>   {/* copy once at init, isolated */}
  <Child />
</StoreProvider>
<StoreProvider inherit="live" value={{ record }}>            {/* live scope chain (see below) */}
  <Child />
</StoreProvider>

// Sync a sub-path from parent props
<StoreProvider path="schema.flat" value={flatMap}>
  <Child />
</StoreProvider>

// Name it so descendants can reach it by id, even past a disconnected provider (see "Named stores")
<StoreProvider id="root" value={builderState}>
  <App />
</StoreProvider>
```

> **`inherit` modes:** `'snapshot'` copies parent keys **once** at init — isolated thereafter: writes stay
> local and parent updates do **not** propagate (use for draft/diverge editors). `'live'` keeps a **live
> link** — inherited keys stay in sync and writes delegate to the owning scope.

## Scoped stores (live scope chain)

A store can have a `parent`. Reads resolve through the chain and writes target the owning scope. This
lets nested scopes (e.g. a list item providing its own `record`) shadow shared/global state while still
reading it live — without prop-drilling or N value-contexts.

```ts
const root = createStore<S>({ user: { name: 'Alice' }, theme: 'dark' });
const item = createStore<S>({ record }, { parent: root });
```

**Semantics**

- **Read fall-through (deep-merge)** — `getState()` deep-merges the chain: own values win, but nested
  object branches are **merged**, not replaced, so a scope can contribute a sub-key without clobbering the
  parent's siblings under the same branch.
  ```ts
  item.getState().record; // own
  item.getState().user;   // inherited from root (live)

  // deep-merge of a shared branch:
  const root = createStore<S>({ runtime: { sources: { variables: { a: 1 } } } });
  const item = createStore<S>({ runtime: { sources: { record } } }, { parent: root });
  item.getState().runtime.sources; // { variables: { a: 1 }, record } ← merged, not shadowed
  ```
- **Shadowing** — a scope's own **leaf** value hides the parent's at that path (reads and subscriptions);
  sibling leaves under a shared object branch are preserved (see deep-merge above).
  ```ts
  const item = createStore<S>({ theme: 'light' }, { parent: root });
  item.getState().theme; // 'light' (shadows root's 'dark')
  root.getState().theme; // 'dark' (untouched)
  ```
- **Write delegation (recursive to owner / root)** — `setState(path)` walks up to the nearest scope that
  owns the path; if no ancestor owns it, it delegates all the way to the **root**. So a deeply-nested scope
  can write a shared branch (e.g. `runtime.sources.*`) and it lands at the root without any scope having to
  pre-seed that branch.
  ```ts
  item.setState('user.name', 'Bob');             // delegates to the scope that owns `user`
  item.setState('runtime.sources.x', v);          // delegates to root even if no ancestor seeded `runtime`
  item.setState('record', next);                  // stays local to the item scope (it owns `record`)
  ```
- **Multi-level subscriptions** — consumers of a scope re-render when an inherited key changes in any
  ancestor; shadowed keys are ignored. Equality still filters no-op updates.
- **Cleanup** — call `store.destroy()` (or let `<StoreProvider inherit="live">` do it on unmount) to detach
  from the parent and avoid listener leaks for short-lived scopes.

Via `StoreProvider` (the common case):

```tsx
<StoreProvider value={{ user, theme: 'dark' }}>          {/* root scope */}
  <StoreProvider inherit="live" value={{ record }}>       {/* item scope */}
    {/* useStore('user')   → inherited, live   */}
    {/* useStore('record') → own               */}
    <ItemView />
  </StoreProvider>
</StoreProvider>
```

## Named stores & reaching ancestors (`id` / `storeId` / `useStoreById`)

Give a store an **`id`** and any descendant can target it — even across a **disconnected** (`inherit`-less)
provider that would otherwise shadow it. The id lives in a parallel registry propagated by context
*independently of `inherit`*, so it never breaks the scope chain and costs nothing per provider unless used.

```tsx
<StoreProvider id="root" value={builderState}>
  ...
  <StoreProvider value={{ local: 1 }}>        {/* disconnected — no inherit */}
    <Leaf />
  </StoreProvider>
</StoreProvider>
```

```ts
// inside Leaf — reach the named root store past the disconnected provider:
const [theme, setTheme] = useStore('theme', { storeId: 'root' }); // reactive read + write
const getUser = useStoreGetter('user', { storeId: 'root' });      // imperative read
const setUser = useStoreSetter('user', { storeId: 'root' });      // imperative write

// the raw StoreApi — for createDerived / batch / subscribe / passing around:
const rootStore = useStoreById('root');
rootStore.batch(() => { ... });
const itemCount = createDerived(rootStore, ['items'], ([items]) => items.length);
```

- **`storeId` option** — available on every hook (`useStore`, `useStoreGetter`, `useStoreSetter`,
  `useStoreSync`). Resolves the nearest ancestor store registered under that id. An explicit `store` option
  still wins over `storeId`.
- **`useStoreById(id?)`** — returns the raw `StoreApi`. With no `id`, returns the nearest provider's store.
  Use it when you need the store object itself (`createDerived`/`createAsync`, `batch`, `subscribe`); the
  options above only read/write *through* it.
- **`store.id`** — the identity is also set on the store, handy for logging/devtools.
- **Lifecycle** — registration is context-scoped: an id stops resolving the moment its provider unmounts.
  There is no global registry, so nothing to clean up and no leaks.
- **Duplicate ids (dev)** — registering an id that shadows an ancestor with the same id logs a warning in
  development (stripped in production); the nearer store wins. Sibling subtrees may reuse an id freely.

## `useStore`

Subscribe to store values. Triggers re-render only when the selected value changes.

```ts
// Full state
const [state, setState] = useStore();

// Single path
const [name, setName] = useStore('user.name');

// Fallback for a possibly-undefined value — destructure a default (no `defaultValue` option):
const [el = {}] = useStore(`schema.flat.${id}` as PathOf<MyState>);

// Dynamic path (function resolves the path string at runtime)
const [val, setVal] = useStore(s => `style.platform.${s.displayMode}` as PathOf<MyState>);

// Transform the value (memoized, no extra re-renders)
const [upper] = useStore('user.name', { transformer: v => v.toUpperCase() });

// Multi-path
const [[name, count], setName, setCount] = useStore(['user.name', 'count']);

// Multi-path with dynamic path
const [[name, val], setName, setVal] = useStore([
  'user.name',
  s => `style.${s.displayMode}` as PathOf<MyState>
]);

// Multi-path with transformer
const [derived] = useStore(['user.name', 'count'], {
  transformer: ([name, count]) => `${name} (${count})`
});

// Options
useStore('user.name', { enabled: false });       // unsubscribed
useStore('user.name', { mode: 'mount' });        // read once on mount
useStore('user.name', { store: myStore });       // explicit store
useStore('user.name', { storeId: 'root' });      // a named ancestor store (see "Named stores")
useStore('user.name', { equalityFn: Object.is }); // custom equality
```

## `useStoreSync`

Syncs an external value into the store on every render (write-only, no subscription). Returns `void`.

```ts
// Sync full state (merges)
useStoreSync(undefined, fullState);

// Sync a single path
useStoreSync('schema', schema);

// Sync multiple paths
useStoreSync(['schema', 'style'], [schema, style]);

// Options
useStoreSync('schema', schema, { mode: 'mount' });          // sync on mount only
useStoreSync('schema', schema, { enabled: false });         // disabled
useStoreSync('schema', schema, { syncStrategy: 'render' }); // sync during render (no layout effect)
```

## `useStoreGetter`

Non-reactive. Returns a stable getter function that reads the current store value at call time (no re-renders).

```ts
// Full state getter
const get = useStoreGetter();
get();                        // → MyState
get('user.name');             // → string
get('user.name', 'default'); // → string | 'default'

// Scoped getter
const getFlat = useStoreGetter('schema.flat');
getFlat();             // → FlatMap
getFlat(id);           // → Element
getFlat(id, fallback); // → Element | fallback

// Multi-entry tuple
const [getName, getCount] = useStoreGetter(['user.name', 'count']);
getName(); // → string
getCount(); // → number

// Mixed paths + functions
const [getFlat, getCount] = useStoreGetter(['schema.flat', s => s.count]);
```

## `useStoreSetter`

Non-reactive. Returns a stable setter. No re-renders on write.

```ts
// Full setState
const setState = useStoreSetter();
setState('user.name', 'Bob');
setState('user.name', prev => prev + '!');
setState(undefined, fullState);

// Scoped setter
const setFlat = useStoreSetter('schema.flat');
setFlat(id, element);               // sets schema.flat.${id}
setFlat(`${id}.attributes`, attrs); // sets schema.flat.${id}.attributes
setFlat(undefined, flatObj);        // replaces schema.flat
```

## `createStoreHook`

Factory that binds `TState` at the module level, giving fully-typed hooks without repeating the generic at every call site.

```ts
const { useStore, useStoreSync, useStoreGetter, useStoreSetter } = createStoreHook<MyState>();
```

## `createDerived` / `useDerived`

**What it's for:** a value *computed* from store paths — totals, filtered lists, formatted strings. It computes once, memoizes, and only wakes subscribers when the **result** changes (a dependency edit that doesn't affect the output costs nothing downstream). Think reselect / Jotai derived atoms / MobX `computed`, shared across every consumer instead of recomputed per component.

```ts
import { createDerived, useDerived } from '@plitzi/nexus';

const total = createDerived(
  store,
  ['items'],                                    // dependency paths (typed)
  ([items]) => Object.values(items).reduce((s, i) => s + i.qty * i.price, 0)
);

total.get();                                    // current value (recomputed lazily if a dep changed)
const off = total.subscribe(() => render());    // wakes only when `total` changes
total.destroy();                                // detach from the store

// React — the computation is shared, not repeated per component:
function CartTotal() {
  const value = useDerived(total);
  return <span>${value}</span>;
}

// Multiple deps + custom equality (skip object-identity churn):
const ids = createDerived(store, ['items'], ([m]) => Object.keys(m), {
  equalityFn: (a, b) => a.length === b.length && a.every((x, i) => x === b[i])
});
```

> Use `createDerived` for a value shared across components; reach for `useStore('path', { transformer })` when the transform is local to one component.

## `createEntityAdapter`

**What it's for:** the boilerplate around a normalized `Record<id, entity>` map. Write ops return **immutable updaters** you hand straight to `setState`; selectors read a map. (It doesn't change the cost of an immutable map write — see [Performance](#performance) — it just removes the hand-rolled spread/merge.)

```ts
import { createEntityAdapter } from '@plitzi/nexus';

type Todo = { id: string; text: string; done: boolean };
const todos = createEntityAdapter<Todo>(); // selectId defaults to `e => e.id`

store.setState('todos', todos.addMany([a, b]));
store.setState('todos', todos.updateOne({ id: 'a', changes: { done: true } })); // shallow-merge
store.setState('todos', todos.upsertOne(c));
store.setState('todos', todos.removeOne('b'));

const map = store.getPath('todos');
todos.selectAll(map);       // Todo[]
todos.selectById(map, 'a'); // Todo | undefined
todos.selectTotal(map);     // number

// Custom id field + sort order for selectAll / selectIds:
createEntityAdapter<Row>({ selectId: r => r.key, sortComparer: (a, b) => a.name.localeCompare(b.name) });
```

Ops: `addOne/addMany` (ignore existing), `setOne/setMany/setAll` (replace), `updateOne/updateMany` (merge changes), `upsertOne/upsertMany` (add or merge), `removeOne/removeMany/removeAll`. Each returns the **same map reference** when nothing changed, so the store skips the write.

## `createEntityStore` (reactive, O(1) per item)

**What it's for:** the same normalized collection, but as a **standalone reactive store** that notifies *per item*. Where `createEntityAdapter` lives inside a `StoreApi` path (one map, one subscription — every consumer wakes when any item changes), `createEntityStore` lets a row subscribe to **just its own id**, so editing one item re-renders only that row, not the list. Use it for large lists / tables where the adapter's whole-map churn shows up.

```ts
import { createEntityStore } from '@plitzi/nexus';

const todos = createEntityStore<Todo>({ selectId: t => t.id });

todos.setMany([a, b, c]);
todos.updateOne('a', { done: true });
todos.removeOne('b');

todos.getOne('a');                              // Todo | undefined
todos.getIds();                                 // string[]
todos.getAll();                                 // Todo[]
const off = todos.subscribeOne('a', render);    // wakes ONLY when item 'a' changes
```

React — subscribe at the granularity you actually render at:

```tsx
import { useEntity, useEntityIds, useEntityOne } from '@plitzi/nexus/react';

function List() {
  const ids = useEntityIds(todos);              // re-renders only on add/remove
  return ids.map(id => <Row key={id} id={id} />);
}

function Row({ id }: { id: string }) {
  const todo = useEntityOne(todos, id);         // re-renders only when THIS item changes
  return <li>{todo?.text}</li>;
}

// Or the bound shape: const { useOne, useIds, useAll } = useEntity(todos);
```

## `createAsync` / `useAsync` (race-safe fetch)

**What it's for:** a fetch whose result lands on a store path, with status tracking and last-write-wins race safety, shared across every consumer. Read it inline (loading / error UI) with `useAsync`, or unwrap the value (Suspense) with `useAsyncValue`.

```ts
import { createAsync } from '@plitzi/nexus';

const user = createAsync(store, 'user', async (id: string) => fetchUser(id));
user.run('42');                                 // kicks off; a newer run() supersedes an in-flight one
user.get();                                     // { status, data, error }
```

```tsx
import { useAsync, useAsyncValue } from '@plitzi/nexus/react';

function Profile() {
  const { status, data, error } = useAsync(user); // re-renders on status / value change
  if (status === 'pending') { return <Spinner />; }

  return <span>{data?.name}</span>;
}

// Suspense form — throws the promise while pending, returns the value when settled:
function ProfileSuspense() {
  const data = useAsyncValue(user);

  return <span>{data.name}</span>;
}
```

## Middleware (`loggerMiddleware` / `persistMiddleware` / `historyMiddleware`)

**What it's for:** cross-cutting logic on every write, centralized in one place. A middleware is `(api) => { beforeChange?, onChange? } | void`; its setup body runs once after creation (so it can hydrate). It can do two things: **intercept** a write before it commits (`beforeChange`) and **observe** a write after it commits (`onChange`, the `{ path, prev, next }` change). logger, persist, and history are built-in observers; write your own the same way. Middlewares are per-store — in a scope chain, attach them where the writes you care about commit (shared keys delegate to the owning scope, so the owning scope's interceptors run).

```ts
import { createStore, loggerMiddleware, persistMiddleware, historyMiddleware } from '@plitzi/nexus';

const store = createStore<State>(initial, {
  middlewares: [
    persistMiddleware({ key: 'app' }), // put persist FIRST so it hydrates before others observe
    historyMiddleware(),
    loggerMiddleware()
  ]
});

// Write your own — an observer of every committed change:
const analytics: StoreMiddleware<State> = api => ({
  onChange: ({ path, prev, next }) => track('store.change', { path })
});

// Or subscribe imperatively to the same substrate:
const off = store.subscribeChange(({ path, prev, next }) => {});
```

### `cascade` — share a middleware with nested scopes

Middlewares are per-store, so a nested `StoreProvider` (or scoped `createStore`) doesn't inherit the parent's
middlewares by default. Wrap one in `cascade()` to have every descending store get its **own instance** of it —
set a logger or analytics sink once at the root instead of repeating it in each child.

```ts
import { createStore, cascade, loggerMiddleware } from '@plitzi/nexus';

const root = createStore<State>(initial, {
  middlewares: [cascade(loggerMiddleware())] // child scopes log too, each with its own instance
});
```

Storage- or recorder-bound middlewares (`persistMiddleware`, `historyMiddleware`) are deliberately **not**
cascaded — they're per-store by nature (one storage key, one recorder). Only mark them if you really mean it.

### Intercepting writes (`beforeChange`)

`onChange` only **observes** committed changes — it can't stop or rewrite them. A middleware's `beforeChange` runs **before** the write commits and can transform the value, or cancel the write entirely by returning `CANCEL`. Returning `undefined` lets the value through unchanged. It's just another middleware, so you write your own the same way you'd write a logger.

```ts
import { createStore, CANCEL } from '@plitzi/nexus';

const guard: StoreMiddleware<State> = () => ({
  beforeChange: ({ path, value, prev }) => {
    if (path === 'role' && !isAdmin) {
      return CANCEL; // block the write — nothing commits, no observer fires
    }

    if (path === 'ui.size') {
      return Math.min(value as number, 100); // clamp before it commits
    }

    return undefined; // let everything else through unchanged
  }
});

const store = createStore<State>(initial, { middlewares: [guard] });
```

`beforeChange` receives a `WriteContext`: `{ path, value, prev }` — the changed `path` (`undefined` for a whole-state write, where `value` is the full next state), the resolved `value` about to be written (function setters are already applied, so you see the concrete value), and the current `prev` at that path.

When several middlewares declare a `beforeChange`, they run in **middleware order**, each seeing the previous one's result — so an earlier one can transform a value and a later one can still cancel it. Like every middleware, they run on the store that commits the write (in a scope chain, a write delegated to the owning scope runs that scope's interceptors).

### `persistMiddleware`

Mirrors the store to a key/value storage and rehydrates on creation.

```ts
persistMiddleware<State>({
  key: 'app',
  storage,                              // default: localStorage, no-op on SSR. Any { getItem, setItem, removeItem }
  partialize: s => ({ user: s.user }),  // persist only part of the state
  version: 2,                           // bump when the shape changes…
  migrate: (old, v) => ({ user: old }), // …and map an older payload forward
  merge: (persisted, current) => ({ ...current, ...persisted }),
  debounce: 200                         // coalesce rapid writes (ms); 0 = write synchronously
});
```

### `loggerMiddleware`

```ts
loggerMiddleware<State>({
  filter: change => change.path !== 'mouse', // log only some changes
  sink: change => console.log(change.path, change.next) // default sink is console.log
});
```

### `reduxDevToolsMiddleware`

Mirrors the store to the [Redux DevTools](https://github.com/reduxjs/redux-devtools) browser extension: every committed change is sent as an action (labelled by the changed path) and time-travel from the DevTools UI (jump / rollback) is written back into the store. It's a **no-op** when the extension isn't installed (production, SSR, browsers without it), so it's safe to leave wired in.

```ts
import { createStore, reduxDevToolsMiddleware } from '@plitzi/nexus';

const store = createStore<State>(initial, {
  middlewares: [reduxDevToolsMiddleware({ name: 'my-app' })]
});

store.setState('count', 1);         // → action "count" in DevTools
store.setState('user.name', 'Bob'); // → action "user.name"
```

```ts
reduxDevToolsMiddleware<State>({
  name: 'my-app',                              // instance name in the DevTools dropdown (default 'nexus')
  action: change => `set:${change.path}`       // how to label each action (default: the changed path)
});
```

Intended for the root store; like `persist`/`history` it's per-store and not cascaded.

## Time-travel (`historyMiddleware`)

Records an action log you can undo / redo / jump through. Enable it by adding `historyMiddleware()` to the store; read it reactively with `useStoreHistory`, or imperatively with `getStoreHistory(store)` (which returns the handle the middleware registered, or `undefined` when it isn't enabled). Without the middleware, `useStoreHistory` returns an empty, no-op view.

```tsx
import { useStoreHistory } from '@plitzi/nexus';

function HistoryPanel() {
  const { entries, index, canUndo, canRedo, undo, redo, travelTo } = useStoreHistory<State>();

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
}
```

`<StoreProvider history>` (or `history="schema"` to scope it to a subtree) starts recording from mount.

## CSP & `new Function`

By default `@plitzi/nexus` uses a compiled codegen path (`new Function`) for structural-sharing writes, which is orders of magnitude faster than the recursive fallback for deep paths. When a strict [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) blocks `new Function`, the store auto-detects the error at first use and falls back to a recursive writer with identical behaviour — you **don't need to do anything** for CSP environments to work.

If you want to avoid even the one-time probe, force the recursive fallback directly:

```ts
import { setCodegenEnabled } from '@plitzi/nexus';

// Skip codegen probe, go straight to recursive writer (no new Function)
setCodegenEnabled(false);
```

| Value | Behaviour |
|---|---|
| `undefined` (default) | Auto-detect: probe `new Function` once; cache result. |
| `false` | Bypass probe entirely — recursive writer only. Safe for strict CSP. |
| `true` | Force codegen even if probe fails (testing only). |

Call `setCodegenEnabled(undefined)` to restore auto-detection.

## Server Components & SSR

Nexus supports React Server Components (App Router) and server-side rendering (Pages Router) with no additional setup.

### Auto-detected SSR safety

When a store is created on the server (`typeof window === 'undefined'`), Nexus automatically:

- **Disables codegen** — `new Function` is never called, so a strict Content-Security-Policy won't break SSR. Falls back to the recursive writer with identical behaviour.
- **Disables localStorage** — `persistMiddleware` falls back to a no-op storage so `getItem`/`setItem` never throw.
- **Defers hydration** — `StoreProvider` runs `persistMiddleware` hydration in a `useEffect` after React hydration, preventing hydration mismatches.

You don't need to configure anything for SSR to work.

### Server Components → Client data handoff

Wrap server-fetched data with `createServerSnapshot` to mark it as coming from the server:

```tsx
// app/page.tsx — Server Component (App Router)
import { StoreProvider } from '@plitzi/nexus';
import { createServerSnapshot } from '@plitzi/nexus/rsc';

export default async function Page() {
  const posts = await fetch('https://api.example.com/posts').then(r => r.json());

  return (
    <StoreProvider value={createServerSnapshot({ posts })}>
      <ClientContent />
    </StoreProvider>
  );
}
```

```tsx
// app/ClientContent.tsx — Client Component
'use client';
const { useStore } = createStoreHook<{ posts: Post[] }>();

function ClientContent() {
  const [posts] = useStore('posts');
  // posts is available without a loading state — it was already fetched on the server
}
```

The SSR flag is a non-enumerable Symbol — invisible in spread/JSON. Using `createServerSnapshot` is optional; plain objects work too.

### `rsc` subpath exports

| Import | What it's for |
|---|---|
| `createServerSnapshot` | Mark data as server-fetched (type-level marker) |
| `isServerSnapshot` | Check if a value has the SSR flag |
| `stripServerFlag` | Remove the SSR flag from a value |

Import from `@plitzi/nexus/rsc` or from the main entry.

### App Router — full pattern

```tsx
// app/providers.tsx
'use client';
import { StoreProvider, createServerSnapshot } from '@plitzi/nexus';
import type { ReactNode } from 'react';

type AppState = {
  user: { name: string; email: string } | null;
  theme: 'light' | 'dark';
  posts: Array<{ id: string; title: string }>;
};

export function AppProviders({
  children,
  initialState
}: {
  children: ReactNode;
  initialState: AppState;
}) {
  return (
    <StoreProvider value={createServerSnapshot(initialState)}>
      {children}
    </StoreProvider>
  );
}

// app/layout.tsx — Server Component
import { AppProviders } from './providers';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSession();
  return (
    <html>
      <body>
        <AppProviders initialState={{ user, theme: 'light', posts: [] }}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}

// app/dashboard/page.tsx — Server Component
export default async function DashboardPage() {
  const posts = await db.posts.findMany();
  return <DashboardClient posts={posts} />;
}

// app/dashboard/DashboardClient.tsx — Client Component
'use client';
import { useStoreSync, createStoreHook } from '@plitzi/nexus';

type State = { posts: Array<{ id: string; title: string }> };
const { useStore } = createStoreHook<State>();

export function DashboardClient({ posts }: { posts: State['posts'] }) {
  // Sync server data on mount — avoids overwriting user edits on re-renders
  useStoreSync('posts', posts, { mode: 'mount' });
  const [localPosts] = useStore('posts');

  return (
    <div>
      {localPosts.map(post => <div key={post.id}>{post.title}</div>)}
    </div>
  );
}
```

### Pages Router — full pattern

```tsx
// pages/dashboard.tsx
import { createStoreHook, StoreProvider } from '@plitzi/nexus';
import type { InferGetServerSidePropsType } from 'next';

type State = { count: number; user: { name: string } };

export const getServerSideProps = async () => {
  const user = await api.getUser();
  return { props: { user } };
};

export default function DashboardPage({
  user
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <StoreProvider value={{ user, count: 0 }}>
      <Dashboard />
    </StoreProvider>
  );
}

// components/Dashboard.tsx
'use client';
const { useStore } = createStoreHook<State>();

function Dashboard() {
  const [user] = useStore('user');
  const [count, setCount] = useStore('count');
  return <div>...</div>;
}
```

### Server Actions (`@plitzi/nexus/next`)

The `@plitzi/nexus/next` subpath exports a `bindServerAction` helper for optimistic updates
with automatic revalidation:

```tsx
'use client';
import { useStore } from '@plitzi/nexus';
import { bindServerAction } from '@plitzi/nexus/next';

function Likes({ store, updateLikes }: { store: StoreApi<State>; updateLikes: ServerAction }) {
  const [likes, setLikes] = useStore('likes');
  const syncLikes = bindServerAction(store, 'likes', updateLikes, { revalidatePath: '/dashboard' });

  return <button onClick={() => syncLikes(n => n + 1)}>{likes}</button>;
}
```

| Import | What it's for |
|---|---|
| `bindServerAction` | Optimistic update + rollback + revalidation for Next.js Server Actions |
| `ServerActionResult` | Return type of `bindServerAction` |

This module dynamically imports from `next/cache` — it only works within Next.js App Router.
It is **not** a peer dependency, just a compatibility layer.

## Vue 3 (`@plitzi/nexus/vue`)

The same agnostic core, bound to Vue's reactivity via `provide`/`inject` and composables that return refs.
Provide a store at a parent, then bind a path two-ways with `useStore` (write through `ref.value` or `v-model`),
or read-only with `useStoreValue`.

```vue
<!-- App.vue -->
<script setup lang="ts">
import { provideStore } from '@plitzi/nexus/vue';

type State = { count: number; user: { name: string } };
provideStore<State>({ count: 0, user: { name: 'Ada' } });
</script>

<!-- Counter.vue -->
<script setup lang="ts">
import { useStore, useStoreValue } from '@plitzi/nexus/vue';

const count = useStore<State, 'count'>('count'); // WritableComputedRef — re-renders only on change
const name = useStoreValue<State, 'user.name'>('user.name'); // read-only ref
</script>

<template>
  <button @click="count++">{{ name }}: {{ count }}</button>
</template>
```

`createStoreComposable<State>()` mirrors React's `createStoreHook` — it returns `useStore` / `useStoreValue` /
`useStoreState` already bound to `State`. Vue also ships `useEntity`, `useDerived`, `useAsync`, and
`useStoreHistory` composables matching their React counterparts.

## Performance

Notification is `O(depth)` — a few `Map` lookups for the changed path's prefixes — **regardless of how many subscribers exist**, so a million watchers cost the same as one for an unrelated change. The *write* copies the containers on the changed path (immutable structural sharing, the same cost Redux / Zustand / Jotai pay), so model state as a **tree / normalized map** to keep each write touching a small path. Single-segment writes mutate the live working copy in place (O(1)); snapshots from `getState()` are always distinct clones, so they stay immutable for React.

## Types

All types live in `src/types/StoreTypes.ts`:

| Type | Description |
|---|---|
| `PathOf<T>` | Union of all valid dot-paths in `T` |
| `PathValue<T, P>` | Value type at path `P` in `T` |
| `PathOrFn<T>` | `PathOf<T>` or a function `(state: T) => PathOf<T>` |
| `PathValues<T, Paths>` | Tuple of values for an array of paths |
| `PathSetter<T, P>` | Setter function for a single path |
| `PathSetters<T, Paths>` | Tuple of setters for an array of paths |
| `MultiPathReturn<T, Paths>` | `[values, ...setters]` tuple |
| `StoreApi<T>` | `{ getState, getPath, setState, subscribe, subscribePath, subscribeChange, destroy? }` |
| `StoreChange<T>` | `{ path, prev, next }` — payload of `subscribeChange` / middleware `onChange` |
| `StoreMiddleware<T>` | `(api) => { beforeChange?, onChange? } \| void` — a middleware factory |
| `WriteContext<T>` | `{ path, value, prev }` — payload of a `beforeChange` interceptor |
| `WriteInterceptor<T>` | `(ctx: WriteContext<T>) => unknown` — return a value, `CANCEL`, or `undefined` |
| `CANCEL` | Sentinel an interceptor returns to abort a write |
| `Derived<R>` | `{ get, subscribe, destroy }` — a `createDerived` handle |
| `EntityAdapter<T>` | CRUD updaters + selectors from `createEntityAdapter` |
| `EntityUpdater<T>` | `(map) => map` — an immutable entity-map update for `setState` |
| `SetState<T>` | Full `setState` overload signature |
| `UseStoreOptions` | Options for `useStore` (mode, enabled, equalityFn, transformer, store, storeId) |
| `UseStoreMultiOptions` | Options for multi-path `useStore` |
| `UseStoreSyncOptions` | Options for `useStoreSync` (mode, enabled, syncStrategy) |
| `UseStoreSyncMultiOptions` | Options for multi-path `useStoreSync` |
| `UseStoreGetterOptions` | Options for `useStoreGetter` |
| `UseStoreSetterOptions` | Options for `useStoreSetter` |
