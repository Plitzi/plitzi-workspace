import { useCallback, useMemo } from 'react';

import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';

import useQueueManager from './hooks/useQueueManager';
import QueueContext from './QueueContext';
import QueueStatusContext from './QueueStatusContext';

import type { QueueContextValue } from './QueueContext';
import type { ReactNode } from 'react';

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

  const enqueueSchema = useCallback<QueueContextValue['enqueueSchema']>(
    (prevState, state, dispatch, action) => enqueue({ kind: 'schema', action, prevState, state, dispatch }),
    [enqueue]
  );

  const enqueueStyle = useCallback<QueueContextValue['enqueueStyle']>(
    (prevState, state, dispatch, action) => enqueue({ kind: 'style', action, prevState, state, dispatch }),
    [enqueue]
  );

  const queueValue = useMemo(() => ({ enqueueSchema, enqueueStyle }), [enqueueSchema, enqueueStyle]);

  return (
    <QueueContext value={queueValue}>
      <QueueStatusContext value={processing}>{children}</QueueStatusContext>
    </QueueContext>
  );
};

export default QueueContextProvider;
