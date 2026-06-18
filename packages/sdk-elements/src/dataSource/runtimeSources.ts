import { createStoreHook } from '@plitzi/nexus/createStore';

import type { CommonState } from '@plitzi/sdk-shared';

type SourcePath = `runtime.sources.${string}`;

// The `runtime.sources.*` registry holds dynamic, per-source value bags addressed by string key. Those deep
// paths fall outside `PathOf<CommonState>` — TypeScript truncates that branch under the weight of the large
// state type — so we reach them through a string-typed view of the store hooks. This mirrors the cast in
// `useRegisterSource` (the typed setter can't express the dynamic registry paths either).

export const useSourceSync = (path: SourcePath, value: Record<string, unknown>): void => {
  const { useStoreSync } = createStoreHook<CommonState>();

  (useStoreSync as unknown as (p: string, v: unknown) => void)(path, value);
};

export const useSourcesValues = (paths: ReadonlyArray<SourcePath>): unknown[] => {
  const { useStore } = createStoreHook<CommonState>();
  const [values] = (useStore as unknown as (p: readonly string[]) => [unknown[]])(paths);

  return values;
};

export const useSourceValue = (
  path: SourcePath,
  defaultValue: Record<string, unknown> = {}
): Record<string, unknown> => {
  const { useStore } = createStoreHook<CommonState>();
  const [value] = (
    useStore as unknown as (p: string, o: { defaultValue: Record<string, unknown> }) => [Record<string, unknown>]
  )(path, { defaultValue });

  return value;
};
