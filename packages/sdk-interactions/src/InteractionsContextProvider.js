// Packages
import React, { useMemo } from 'react';

// Relatives
import InteractionsContext from './InteractionsContext.js';
import useInteractions from './hooks/useInteractions.js';
import InteractionsManager from './InteractionsManager.js';

/**
 * @param {{
 *   children: React.ReactNode;
 *   currentPageId: string;
 *   routeParams: object;
 *   queryParams: object;
 * }} props
 * @returns {React.ReactElement}
 */
const InteractionsContextProvider = props => {
  const { children, currentPageId, routeParams, queryParams } = props;
  const interactionsManager = useMemo(() => new InteractionsManager(currentPageId, routeParams, queryParams), []);
  const interactionsData = useMemo(
    () => ({ currentPageId, ...routeParams, ...queryParams }),
    [currentPageId, routeParams, queryParams]
  );
  interactionsManager.interactionsData = interactionsData;

  const valueMemo = useMemo(() => ({ interactionsManager, useInteractions }), [interactionsManager, useInteractions]);

  return <InteractionsContext value={valueMemo}>{children}</InteractionsContext>;
};

export default InteractionsContextProvider;
