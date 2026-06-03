# Store

A lightweight React store built on `useSyncExternalStore`. Provides path-based subscriptions, multi-path reads, snapshot getters, and sync helpers — all type-safe with dot-notation paths.

## Architecture

```
StoreContext.ts          context object (no deps → no cycles)
createStore.ts           factory + createStoreHook
StoreProvider.tsx        context provider with optional sync
hooks/
  shared.ts              snapshot factories, subscription helpers, useResolvedStore
  useStore.ts            subscribe + read
  useStoreSync.ts        sync external value into the store (write-only)
  useStoreGetter.ts      non-reactive snapshot getter
  useStoreSetter.ts      fire-and-forget setter
helpers/
  getByPath.ts           read nested value by dot-path
  setByPath.ts           immutable write at dot-path
  isPathAffected.ts      ancestor/descendant path check
  shallowEqual.ts        shallow object comparison
  useIsomorphicLayoutEffect.ts  useLayoutEffect (client) / useEffect (server)
```

## `createStore`

```ts
const store = createStore<MyState>({ count: 0, user: { name: 'Alice' } });
// or with an initializer function:
const store = createStore<MyState>((setState, getState) => ({ count: 0 }));

// Scoped store: reads fall through to a parent store (see "Scoped stores" below)
const child = createStore<MyState>({ record }, { parent: rootStore });

// With a devtools logger
const store = createStore<MyState>({ count: 0 }, { logger: myLogger });
```

`StoreApi` exposes `getState`, `setState`, `subscribe`, `subscribePath`, and `destroy?()`. Call
`destroy()` to detach a scoped store from its parent and clear its listeners (prevents leaks for
short-lived scopes like list items). `StoreProvider` calls it automatically on unmount.

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

## `useStore`

Subscribe to store values. Triggers re-render only when the selected value changes.

```ts
// Full state
const [state, setState] = useStore();

// Single path
const [name, setName] = useStore('user.name');

// With default value
const [el, setEl] = useStore(`schema.flat.${id}` as PathOf<MyState>, { defaultValue: {} });

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
| `StoreApi<T>` | `{ getState, setState, subscribe, subscribePath, destroy? }` |
| `SetState<T>` | Full `setState` overload signature |
| `UseStoreOptions` | Options for `useStore` (mode, enabled, equalityFn, defaultValue, transformer) |
| `UseStoreMultiOptions` | Options for multi-path `useStore` |
| `UseStoreSyncOptions` | Options for `useStoreSync` (mode, enabled, syncStrategy) |
| `UseStoreSyncMultiOptions` | Options for multi-path `useStoreSync` |
| `UseStoreGetterOptions` | Options for `useStoreGetter` |
| `UseStoreSetterOptions` | Options for `useStoreSetter` |
