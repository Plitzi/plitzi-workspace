import { use, useMemo } from 'react';

import NetworkInternalContext from '@plitzi/sdk-shared/network/NetworkInternalContext';
import BuilderStyleContextProvider from '@plitzi/sdk-style/BuilderStyleContextProvider';
import QueueContext from '@pmodules/Queue/QueueContext';
import UndoableContext from '@pmodules/Undoable/UndoableContext';

import type { ReducerMiddlewareCallback } from '@plitzi/plitzi-ui';
import type { Style } from '@plitzi/sdk-shared';
import type { StyleReducerActions } from '@plitzi/sdk-style/StyleReducer';

export type StyleContextProviderProps = {
  children: React.ReactNode;
  includeSubscriptions?: boolean;
};

const StyleContextProvider = ({ children, includeSubscriptions = true }: StyleContextProviderProps) => {
  const { style } = use(NetworkInternalContext);
  const { enqueueMiddleware } = use(QueueContext);
  const { undoableMiddleware } = use(UndoableContext);

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
