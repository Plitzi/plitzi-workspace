import { useCallback, useMemo } from 'react';

import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';

import useQueueManager from './hooks/useQueueManager';
import QueueContext from './QueueContext';
import QueueStatusContext from './QueueStatusContext';

import type { SchemaReducerActions } from '@plitzi/sdk-schema/SchemaReducer';
import type { Schema, Style } from '@plitzi/sdk-shared';
import type { StyleReducerActions } from '@plitzi/sdk-style/StyleReducer';
import type { ActionDispatch, ReactNode } from 'react';

export type QueueContextProviderProps = {
  children: ReactNode;
  includeSubscriptions?: boolean;
};

const QueueContextProvider = ({ children, includeSubscriptions = true }: QueueContextProviderProps) => {
  const { mutate } = useBuilderNetwork();

  const { enqueue, processing } = useQueueManager({
    delay: 100,
    mutate,
    maxRetries: 0,
    disabled: !includeSubscriptions
  });

  const enqueueMiddleware = useCallback(
    (
      prevState: Style | Schema,
      state: Style | Schema,
      dispatch: ActionDispatch<[action: StyleReducerActions | SchemaReducerActions]>,
      action: StyleReducerActions | SchemaReducerActions
    ) => enqueue({ action, prevState, state, dispatch }),
    [enqueue]
  );

  const queueValue = useMemo(() => ({ enqueueMiddleware }), [enqueueMiddleware]);

  return (
    <QueueContext value={queueValue}>
      <QueueStatusContext value={processing}>{children}</QueueStatusContext>
    </QueueContext>
  );
};

export default QueueContextProvider;
