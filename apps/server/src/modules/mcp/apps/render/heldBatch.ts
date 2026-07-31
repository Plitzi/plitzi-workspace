/** Where the batch a widget was built from survives between calls — on the HOST, so the server can keep nothing.
 *
 *  It cannot live in the view's memory: the Apps spec binds a view to ONE tool call (`ui/notifications/tool-input`
 *  is sent "at most once", and the host renders a fresh iframe when a UI tool is called), so the patch call the
 *  model makes arrives in a brand-new instance whose memory is empty. localStorage keyed by an id the server hands
 *  back is the spec's own state-persistence pattern (`_meta.viewUUID` in the Apps docs); here the key is the
 *  renderId, which the model also carries, so a patch names the widget it means instead of assuming "the last one".
 */

const PREFIX = 'plitzi.render.';
const MAX_ENTRIES = 5;
// A renderId only lives in one conversation's context, so a batch outlives its usefulness the moment that
// conversation is over — and a conversation the user abandoned would otherwise leave its widget in the host's
// storage for good. Generous enough that no live conversation loses its widget, short enough to be housekeeping.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type Stored = { savedAt: number; operations: unknown[] };

// A sandboxed iframe without allow-same-origin throws on the ACCESS to localStorage, not on the call — so even
// reading the property has to be guarded. A host that denies storage simply gets no patching.
const localStore = (): Storage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

const parse = (raw: string | null): Stored | undefined => {
  if (raw === null) {
    return undefined;
  }

  try {
    const value = JSON.parse(raw) as Stored;

    return Array.isArray(value.operations) ? value : undefined;
  } catch {
    return undefined;
  }
};

const ownKeys = (store: Storage): string[] => {
  const keys: string[] = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key !== null && key.startsWith(PREFIX)) {
      keys.push(key);
    }
  }

  return keys;
};

const dropStale = (store: Storage, keep: string): void => {
  const others = ownKeys(store)
    .filter(key => key !== keep)
    .map(key => ({ key, savedAt: parse(store.getItem(key))?.savedAt ?? 0 }))
    .sort((a, b) => b.savedAt - a.savedAt);
  const expired = Date.now() - MAX_AGE_MS;

  for (const [index, entry] of others.entries()) {
    if (index >= MAX_ENTRIES - 1 || entry.savedAt < expired) {
      store.removeItem(entry.key);
    }
  }
};

export const readHeldBatch = (renderId: string, store = localStore()): unknown[] | undefined => {
  if (!store) {
    return undefined;
  }

  const stored = parse(store.getItem(`${PREFIX}${renderId}`));
  if (!stored || stored.savedAt < Date.now() - MAX_AGE_MS) {
    return undefined;
  }

  return stored.operations;
};

export const writeHeldBatch = (renderId: string, operations: unknown[], store = localStore()): void => {
  if (!store) {
    return;
  }

  const key = `${PREFIX}${renderId}`;
  const payload = JSON.stringify({ savedAt: Date.now(), operations } satisfies Stored);

  try {
    dropStale(store, key);
    store.setItem(key, payload);
  } catch {
    // Out of quota: the widget just rendered is the only one still worth patching, so the rest go.
    for (const other of ownKeys(store)) {
      if (other !== key) {
        store.removeItem(other);
      }
    }

    try {
      store.setItem(key, payload);
    } catch {
      // Storage is full or refused: patching degrades to "re-send the full batch", never to a wrong widget.
    }
  }
};
