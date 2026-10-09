import { use, useEffect, useMemo } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import type { ReactNode } from 'react';

export type ReplicaProviderProps = { children?: ReactNode };

const ReplicaProvider = ({ children }: ReplicaProviderProps) => {
  const {
    contexts: { InteractionsContext }
  } = usePlitziServiceContext();

  // Interactions

  const interactionsContext = use(InteractionsContext);
  const interactionsManagerChild = useMemo(
    () => interactionsContext.interactionsManager.createChildManager(),
    [interactionsContext]
  );

  const interactionsContextSource = useMemo(
    () => ({ ...interactionsContext, interactionsManager: interactionsManagerChild }),
    [interactionsContext, interactionsManagerChild]
  );

  useEffect(() => {
    return () => {
      interactionsContext.interactionsManager.removeChildManager(interactionsManagerChild);
    };
  }, [interactionsContext, interactionsManagerChild]);

  return <InteractionsContext value={interactionsContextSource}>{children}</InteractionsContext>;
};

export default ReplicaProvider;
