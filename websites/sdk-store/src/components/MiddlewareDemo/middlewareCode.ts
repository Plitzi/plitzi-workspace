export const MIDDLEWARE_CODE = `import { StoreProvider, loggerMiddleware, persistMiddleware, historyMiddleware, cascade } from '@plitzi/sdk-store';

type State = { count: number; user: { name: string } };

// logger, persist, history and your own middleware all ride ONE
// substrate (subscribeChange). Put persist first so it hydrates
// before the others observe. cascade() makes a middleware flow
// down to nested providers — set the logger once at the root.
const middlewares = [
  persistMiddleware<State>({ key: 'app' }),          // save to / restore from storage
  cascade(loggerMiddleware<State>(change => feed(change))), // log every change, inherited by children
  historyMiddleware<State>()                          // record snapshots for undo/redo
];

function App() {
  return (
    <StoreProvider<State> value={initial} middlewares={middlewares}>
      <Controls />            {/* useStoreHistory() → undo / redo  */}

      {/* Nested store with NO middlewares — it still logs, because
          the logger was cascade()'d. persist/history are per-store
          and intentionally NOT cascaded. */}
      <StoreProvider value={{ ping: 0 }}>
        <ChildWidget />
      </StoreProvider>
    </StoreProvider>
  );
}

// Write your own: an observer of every committed change.
const analytics = api => ({
  onChange: ({ path, next }) => track('store', { path })
});
createStore<State>(initial, { middlewares: [analytics] });`;
