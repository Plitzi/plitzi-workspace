// Packages
import React, { use, useEffect, useMemo } from 'react';
import get from 'lodash/get.js';

// Monorepo
import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';

/**
 * @param {{
 *   children: React.ReactNode;
 *   id: string;
 *   source: string;
 * }} props
 * @returns {React.ReactElement}
 */
const ReplicaProvider = props => {
  const { children, id = '' } = props;
  const {
    contexts: { InteractionsContext }
  } = usePlitziServiceContext();

  // Interactions

  const interactionsContext = use(InteractionsContext);
  const interactionsManager = get(interactionsContext, 'interactionsManager');
  const interactionsManagerChild = useMemo(() => interactionsContext.interactionsManager.createChildManager(), [id]);

  const interactionsContextSource = useMemo(
    () => ({ ...interactionsContext, interactionsManager: interactionsManagerChild }),
    [interactionsContext, interactionsManagerChild]
  );

  useEffect(() => {
    return () => {
      interactionsManager.removeChildManager(interactionsManagerChild);
    };
  }, [interactionsManagerChild]);

  return <InteractionsContext value={interactionsContextSource}>{children}</InteractionsContext>;
};

export default ReplicaProvider;
