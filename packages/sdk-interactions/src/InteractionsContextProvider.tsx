// Packages
import { useMemo } from 'react';

// Relatives
import useInteractions from './hooks/useInteractions';
import InteractionsContext from './InteractionsContext';
import InteractionsManager from './InteractionsManager';

// Types
import type { InteractionsContextValue } from './InteractionsContext';
import type { ReactNode } from 'react';

export type InteractionsContextProviderProps = {
  children?: ReactNode;
  currentPageId: string;
  routeParams: Record<string, string>;
  queryParams: Record<string, string>;
};

const InteractionsContextProvider = ({
  children,
  currentPageId,
  routeParams,
  queryParams
}: InteractionsContextProviderProps) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const interactionsManager = useMemo(() => new InteractionsManager(currentPageId, routeParams, queryParams), []);
  const interactionsData = useMemo(
    () => ({ currentPageId, ...routeParams, ...queryParams }),
    [currentPageId, routeParams, queryParams]
  );
  interactionsManager.interactionsData = interactionsData;

  const valueMemo = useMemo<InteractionsContextValue>(
    () => ({ interactionsManager, useInteractions }),
    [interactionsManager]
  );

  return <InteractionsContext value={valueMemo}>{children}</InteractionsContext>;
};

export default InteractionsContextProvider;
