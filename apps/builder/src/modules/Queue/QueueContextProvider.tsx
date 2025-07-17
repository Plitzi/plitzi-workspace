import { useCallback, use, useMemo } from 'react';

import NetworkContext from '@pmodules/Network/NetworkContext';

import useQueueManager from './hooks/useQueueManager';
import QueueContext from './QueueContext';
import QueueStatusContext from './QueueStatusContext';

import type { Dispatch, ReactNode } from 'react';

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
      action: { type: string } & Record<Exclude<string, 'type'>, unknown>,
      prevState: unknown,
      state: unknown,
      dispatch: Dispatch<unknown>
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
