export type CoreVerb = {
  verb: string;
  signature: string;
  tagline: string;
  description: string;
  code: string;
};

// The whole imperative surface a newcomer needs. Each maps 1:1 to a thin alias over the tuned read/write/subscribe
// paths — the longer getState/getPath/subscribePath names stay for advanced reads and back-compat.
export const CORE_VERBS: CoreVerb[] = [
  {
    verb: 'get',
    signature: 'store.get(path?)',
    tagline: 'Read any node',
    description: 'Resolve a single path without materializing the whole tree. No path returns the full state.',
    code: "store.get('user.profile.name')\n// → 'Carlos'\n\nstore.get() // → entire state"
  },
  {
    verb: 'set',
    signature: 'store.set(path, value)',
    tagline: 'Write by path',
    description: 'Typed dot-path writes, with an updater form. Only subscribers of that path (and its ancestors) wake.',
    code: "store.set('user.profile.name', 'Ada')\n\nstore.set('cart.items', n => n + 1)"
  },
  {
    verb: 'watch',
    signature: 'store.watch(path?, cb)',
    tagline: 'Subscribe to a path',
    description: 'Run a callback only when that path changes. Returns an unsubscribe. No path watches every change.',
    code: "const off = store.watch(\n  'user.profile.name',\n  v => render(v)\n)"
  }
];
