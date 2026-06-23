import { createStoreHook } from '@plitzi/nexus/react';

export type DemoState = {
  user: {
    profile: { name: string; email: string };
    settings: { theme: string; language: string };
  };
  cart: { items: number; total: number };
};

export type LeafPath =
  | 'user.profile.name'
  | 'user.profile.email'
  | 'user.settings.theme'
  | 'user.settings.language'
  | 'cart.items'
  | 'cart.total';

export const DEMO_INITIAL: DemoState = {
  user: {
    profile: { name: 'Ada', email: 'ada@example.com' },
    settings: { theme: 'dark', language: 'en' }
  },
  cart: { items: 2, total: 38 }
};

export type TreeRow = {
  path?: LeafPath;
  label: string;
  depth: number;
  leaf: boolean;
};

// Flat, ordered description of the nested state above. Branch rows are labels only; leaf rows carry the dot-path a
// `<Leaf>` subscribes to, so the diagram mirrors the real store shape.
export const TREE_ROWS: TreeRow[] = [
  { label: 'user', depth: 0, leaf: false },
  { label: 'profile', depth: 1, leaf: false },
  { path: 'user.profile.name', label: 'name', depth: 2, leaf: true },
  { path: 'user.profile.email', label: 'email', depth: 2, leaf: true },
  { label: 'settings', depth: 1, leaf: false },
  { path: 'user.settings.theme', label: 'theme', depth: 2, leaf: true },
  { path: 'user.settings.language', label: 'language', depth: 2, leaf: true },
  { label: 'cart', depth: 0, leaf: false },
  { path: 'cart.items', label: 'items', depth: 1, leaf: true },
  { path: 'cart.total', label: 'total', depth: 1, leaf: true }
];

export const { useStore: useDemoStore, useStoreSetter: useDemoSetter } = createStoreHook<DemoState>();
