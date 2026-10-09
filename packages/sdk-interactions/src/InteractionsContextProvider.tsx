import { useMemo, useState } from 'react';

import useInteractions from './hooks/useInteractions';
import InteractionsContext from './InteractionsContext';
import InteractionsManager from './InteractionsManager';

import type { InteractionsContextValue } from './InteractionsContext';
import type { QueryParams, RouteParams } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type InteractionsContextProviderProps = {
  children?: ReactNode;
  currentPageId: string;
  routeParams: RouteParams;
  queryParams: QueryParams;
};

const InteractionsContextProvider = ({
  children,
  currentPageId,
  routeParams,
  queryParams
}: InteractionsContextProviderProps) => {
  // One manager for the provider's life: what changes after it is made is handed to it as `interactionsData` below.
  const [interactionsManager] = useState(() => new InteractionsManager(currentPageId, routeParams, queryParams));
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
