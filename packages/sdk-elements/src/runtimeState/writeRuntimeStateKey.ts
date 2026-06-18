import { set } from '@plitzi/plitzi-ui/helpers';
import { produce } from 'immer';

import type { RuntimeState } from '@plitzi/sdk-shared';

// Deep-writes `key` (a dotted path) into runtime.state, preserving structural sharing via immer. Pure: callers wire
// it into their own setter, `setRuntimeState(prev => writeRuntimeStateKey(prev, key, value))`.
export const writeRuntimeStateKey = (state: RuntimeState | undefined, key: string, value: unknown): RuntimeState =>
  produce(state ?? {}, draft => {
    set(draft, key, value);
  });
