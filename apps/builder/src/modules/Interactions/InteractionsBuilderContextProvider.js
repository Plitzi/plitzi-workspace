// Packages
import React, { useContext } from 'react';
import PropTypes from 'prop-types';

// Monorepo
import InteractionsContextProvider from '@plitzi/sdk-interactions/InteractionsContextProvider';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

// Alias
import CollectionInteractions from './sources/CollectionSource/CollectionInteractions';
import PageInteractions from './sources/PageSource/PageInteractions';

const InteractionsBuilderContextProvider = props => {
  const { children, previewMode = true } = props;
  const { currentPageId, routeParams, queryParams } = useContext(NavigationContext);

  return (
    <InteractionsContextProvider currentPageId={currentPageId} routeParams={routeParams} queryParams={queryParams}>
      <CollectionInteractions>
        <PageInteractions previewMode={previewMode}>{children}</PageInteractions>
      </CollectionInteractions>
    </InteractionsContextProvider>
  );
};

InteractionsBuilderContextProvider.propTypes = {
  children: PropTypes.node,
  previewMode: PropTypes.bool
};

export default InteractionsBuilderContextProvider;
