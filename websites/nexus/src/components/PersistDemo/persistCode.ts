export const PERSIST_CODE = `import { createStore, createStoreHook, persistMiddleware } from '@plitzi/nexus';

type State = { clicks: number; note: string };

// persist is a middleware: it hydrates from storage on creation
// and mirrors every change back. SSR-safe.
const store = createStore<State>({ clicks: 0, note: '' }, {
  middlewares: [persistMiddleware({ key: 'demo' })]
});

const { useStore } = createStoreHook<State>();

function Body() {
  const [clicks, setClicks] = useStore('clicks'); // survives reload
  const [note, setNote] = useStore('note');

  return (
    <>
      <button onClick={() => setClicks(n => n + 1)}>clicks +1 → {clicks}</button>
      <input value={note} onChange={e => setNote(e.target.value)} />
    </>
  );
}

// Provide the persisted instance to the tree:
<StoreProvider store={store}><Body /></StoreProvider>`;
