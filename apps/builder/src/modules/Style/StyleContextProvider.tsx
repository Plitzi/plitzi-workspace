import { use, useMemo } from 'react';

import { isUserEdit } from '@plitzi/sdk-shared/helpers';
import NetworkInternalContext from '@plitzi/sdk-shared/network/NetworkInternalContext';
import BuilderStyleContextProvider from '@plitzi/sdk-style/BuilderStyleContextProvider';
import QueueContext from '@pmodules/Queue/QueueContext';
import UndoableContext from '@pmodules/Undoable/UndoableContext';

import type { ReducerMiddlewareCallback } from '@plitzi/plitzi-ui';
import type { Style } from '@plitzi/sdk-shared';
import type { BuilderStyleMiddleware } from '@plitzi/sdk-style/BuilderStyleContextProvider';
import type { StyleReducerActions } from '@plitzi/sdk-style/StyleReducer';

export type StyleContextProviderProps = {
  children: React.ReactNode;
  includeSubscriptions?: boolean;
};

const StyleContextProvider = ({ children, includeSubscriptions = true }: StyleContextProviderProps) => {
  const { style } = use(NetworkInternalContext);
  const { enqueueMiddleware } = use(QueueContext);
  const { undoableMiddleware } = use(UndoableContext);

  // The history middleware is deliberately unfiltered: it has to SEE another session's edit to know its snapshots are
  // stale (it drops them). The queue must not, or it would send the server back the change it just received.
  const middlewares = useMemo<BuilderStyleMiddleware[]>(
    () => [
      { middleware: undoableMiddleware as ReducerMiddlewareCallback<Style, [action: StyleReducerActions]> },
      {
        middleware: enqueueMiddleware as ReducerMiddlewareCallback<Style, [action: StyleReducerActions]>,
        filterCallback: isUserEdit
      }
    ],
    [enqueueMiddleware, undoableMiddleware]
  );

  return (
    <BuilderStyleContextProvider style={style} middlewares={middlewares} includeSubscriptions={includeSubscriptions}>
      {children}
    </BuilderStyleContextProvider>
  );
};

export default StyleContextProvider;
