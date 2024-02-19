// Packages
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

// Relatives
import InteractionsContext from './InteractionsContext';
import useInteractions from './hooks/useInteractions';
import InteractionsManager from './InteractionsManager';

const InteractionsContextProvider = props => {
  const { children, currentPageId, routeParams, queryParams } = props;
  const interactionsManager = useMemo(() => new InteractionsManager(currentPageId, routeParams, queryParams), []);
  const interactionsData = useMemo(
    () => ({ currentPageId, ...routeParams, ...queryParams }),
    [currentPageId, routeParams, queryParams]
  );
  interactionsManager.interactionsData = interactionsData;

  const valueMemo = useMemo(() => ({ interactionsManager, useInteractions }), [interactionsManager, useInteractions]);

  return <InteractionsContext.Provider value={valueMemo}>{children}</InteractionsContext.Provider>;
};

InteractionsContextProvider.propTypes = {
  children: PropTypes.node,
  currentPageId: PropTypes.string,
  routeParams: PropTypes.object,
  queryParams: PropTypes.object
};

export default InteractionsContextProvider;
