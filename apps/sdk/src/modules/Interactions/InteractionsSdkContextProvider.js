// Packages
import React, { useContext } from 'react';
import PropTypes from 'prop-types';

// Monorepo
import InteractionsContextProvider from '@repo/interactions-shared/InteractionsContextProvider';

// Alias
import NavigationContext from '@modules/Navigation/NavigationContext';

const InteractionsSdkContextProvider = props => {
  const { children } = props;
  const { currentPageId, routeParams, queryParams } = useContext(NavigationContext);

  return (
    <InteractionsContextProvider currentPageId={currentPageId} routeParams={routeParams} queryParams={queryParams}>
      {children}
    </InteractionsContextProvider>
  );
};

InteractionsSdkContextProvider.propTypes = {
  children: PropTypes.node
};

export default InteractionsSdkContextProvider;
