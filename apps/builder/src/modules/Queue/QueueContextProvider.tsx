import { useCallback, use, useMemo } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import useQueueManager from './hooks/useQueueManager';
import QueueContext from './QueueContext';
import QueueStatusContext from './QueueStatusContext';

import type { SchemaReducerActions } from '@plitzi/sdk-schema/SchemaReducer';
import type { Schema, Segment, Style } from '@plitzi/sdk-shared';
import type { StyleReducerActions } from '@plitzi/sdk-style/StyleReducer';
import type { SegmentsReducerActions } from '@pmodules/Segments/SegmentsReducer';
import type { ActionDispatch, ReactNode } from 'react';

export type QueueContextProviderProps = {
  children: ReactNode;
  includeSubscriptions?: boolean;
};

const QueueContextProvider = ({ children, includeSubscriptions = true }: QueueContextProviderProps) => {
  const { mutate } = use(NetworkContext);

  const { enqueue, processing } = useQueueManager({
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
