import { useCallback, use, useMemo } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import useQueueManager from './hooks/useQueueManager';
import QueueContext from './QueueContext';
import QueueStatusContext from './QueueStatusContext';

import type { Schema, Segment, Style } from '@plitzi/sdk-shared';
import type { StyleReducerActions } from '@plitzi/sdk-style/StyleReducer';
import type { SchemaReducerActions } from '@pmodules/Schema/SchemaReducer';
import type { SegmentsReducerActions } from '@pmodules/Segments/SegmentsReducer';
import type { ActionDispatch, ReactNode } from 'react';

export type QueueContextProviderProps = {
  children: ReactNode;
  includeSubscriptions?: boolean;
};

const QueueContextProvider = ({ children, includeSubscriptions = true }: QueueContextProviderProps) => {
  const { mutate } = use(NetworkContext);

  const { queueManager, processing } = useQueueManager({
    delay: 100,
    mutate,
    maxRetries: 0,
    disabled: !includeSubscriptions
  });

  const enqueueMiddleware = useCallback(
    (
      prevState: Style | Schema | Record<string, Segment>,
      state: Style | Schema | Record<string, Segment>,
      dispatch: ActionDispatch<[action: StyleReducerActions | SchemaReducerActions | SegmentsReducerActions]>,
      action: StyleReducerActions | SchemaReducerActions | SegmentsReducerActions
    ) => queueManager.enqueue({ action, prevState, state, dispatch }, 'normal'),
    [queueManager]
  );

  const queueValue = useMemo(() => ({ queueManager, enqueueMiddleware }), [queueManager, enqueueMiddleware]);

  return (
    <QueueContext value={queueValue}>
      <QueueStatusContext value={processing}>{children}</QueueStatusContext>
    </QueueContext>
  );
};

export default QueueContextProvider;
