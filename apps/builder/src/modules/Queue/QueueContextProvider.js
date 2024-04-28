// Packages
import React, { useCallback, use, useMemo } from 'react';

// Alias
import NetworkContext from '@pmodules/Network/NetworkContext';

// Relatives
import QueueContext from './QueueContext';
import useQueueManager from './hooks/useQueueManager';
import QueueStatusContext from './QueueStatusContext';

/**
 * @param {{
 *   children: React.ReactNode;
 *   includeSubscriptions?: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const QueueContextProvider = props => {
  const { children, includeSubscriptions = true } = props;
  const { mutate } = use(NetworkContext);

  const { queueManager, processing } = useQueueManager({
    delay: 100,
    mutate,
    maxRetries: 0,
    disabled: !includeSubscriptions
  });

  const enqueueMiddleware = useCallback(
    (action, prevState, state, dispatch) => queueManager.enqueue({ action, prevState, state, dispatch }, 'normal'),
    [queueManager]
  );

  const queueValue = useMemo(() => ({ queueManager, enqueueMiddleware }), [queueManager, enqueueMiddleware]);

  return (
    <QueueContext.Provider value={queueValue}>
      <QueueStatusContext.Provider value={processing}>{children}</QueueStatusContext.Provider>
    </QueueContext.Provider>
  );
};

export default QueueContextProvider;
