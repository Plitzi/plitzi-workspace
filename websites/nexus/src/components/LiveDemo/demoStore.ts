import { createStoreHook } from '@plitzi/nexus';

export type DemoState = {
  count: number;
  user: { name: string };
  theme: 'light' | 'dark';
  synced: number;
};

export const DEMO_INITIAL_STATE: DemoState = {
  count: 0,
  user: { name: 'Alice' },
  theme: 'dark',
  synced: 50
};

export const {
  useStore: useDemoStore,
  useStoreSync: useDemoSync,
  useStoreGetter: useDemoGetter,
  useStoreSetter: useDemoSetter
} = createStoreHook<DemoState>();
