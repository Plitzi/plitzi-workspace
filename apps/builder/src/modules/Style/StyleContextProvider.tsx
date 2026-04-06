import { use, useMemo } from 'react';

import { createStoreHook } from '@plitzi/sdk-shared/store';
import BuilderStyleContextProvider from '@plitzi/sdk-style/BuilderStyleContextProvider';
import NetworkInternalContext from '@pmodules/Network/contexts/NetworkInternalContext';
import QueueContext from '@pmodules/Queue/QueueContext';
import UndoableContext from '@pmodules/Undoable/UndoableContext';

import type { ReducerMiddlewareCallback } from '@plitzi/plitzi-ui';
import type { BuilderState, Style } from '@plitzi/sdk-shared';
import type { StyleReducerActions } from '@plitzi/sdk-style/StyleReducer';

export type StyleContextProviderProps = {
  children: React.ReactNode;
  includeSubscriptions?: boolean;
};

const StyleContextProvider = ({ children, includeSubscriptions = true }: StyleContextProviderProps) => {
  const { style } = use(NetworkInternalContext);
  const { enqueueMiddleware } = use(QueueContext);
  const { undoableMiddleware } = use(UndoableContext);

  const { useStoreSync } = createStoreHook<BuilderState>();
  useStoreSync('style', style);

  const middlewares = useMemo(
    () => [enqueueMiddleware, undoableMiddleware] as ReducerMiddlewareCallback<Style, [action: StyleReducerActions]>[],
    [enqueueMiddleware, undoableMiddleware]
  );

  return (
    <BuilderStyleContextProvider style={style} middlewares={middlewares} includeSubscriptions={includeSubscriptions}>
      {children}
    </BuilderStyleContextProvider>
  );
};

export default StyleContextProvider;
