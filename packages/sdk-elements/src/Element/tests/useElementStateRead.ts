import { useStoreById } from '@plitzi/nexus/react';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import useElementStateSetter, { emptyState } from '../hooks/useElementState';

import type { UseElementStateSetterProps } from '../hooks/useElementState';
import type { CommonState } from '@plitzi/sdk-shared';

/** An element's state as it reads it beside its setter (`useElementInternal`): its path, from the same store. */
export const useElementStateRead = (props: Omit<UseElementStateSetterProps, 'store'>) => {
  const store = useStoreById<CommonState>();
  const { path, setElementState } = useElementStateSetter({ store, ...props });
  const [state] = useCommonStore(path, { store });

  return { state: (state as Record<string, unknown> | undefined) ?? emptyState, setElementState };
};
