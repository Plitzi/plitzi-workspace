import { createStoreHook } from '@plitzi/nexus/react';

import type { BuilderState, CommonState, SdkState } from '../types';

// Pre-instantiated, typed nexus hook bundles. `createStoreHook` captures no store — it only carries the state type and
// delegates to the context-resolved store per call — so each bundle is built once at module load and shared, instead of
// being re-created on every render at each call site. One bundle per state shape: `CommonState` (runtime, shared by
// every surface), `SdkState` (sdk runtime) and `BuilderState` (builder editor).

export const {
  useStore: useCommonStore,
  useStoreSync: useCommonStoreSync,
  useStoreGetter: useCommonStoreGetter,
  useStoreSetter: useCommonStoreSetter
} = createStoreHook<CommonState>();

export const {
  useStore: useSdkStore,
  useStoreSync: useSdkStoreSync,
  useStoreGetter: useSdkStoreGetter,
  useStoreSetter: useSdkStoreSetter
} = createStoreHook<SdkState>();

export const {
  useStore: useBuilderStore,
  useStoreSync: useBuilderStoreSync,
  useStoreGetter: useBuilderStoreGetter,
  useStoreSetter: useBuilderStoreSetter
} = createStoreHook<BuilderState>();
