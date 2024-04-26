// Packages
import React, { useContext } from 'react';

// Monorepo
import InteractionsContextProvider from '@plitzi/sdk-interactions/InteractionsContextProvider';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

// Alias
import CollectionInteractions from './sources/CollectionSource/CollectionInteractions';
import PageInteractions from './sources/PageSource/PageInteractions';

const InteractionsSdkContextProvider = props => {
  const { children, previewMode = false } = props;
  const { currentPageId, routeParams, queryParams } = useContext(NavigationContext);

  return (
    <InteractionsContextProvider currentPageId={currentPageId} routeParams={routeParams} queryParams={queryParams}>
      <CollectionInteractions>
        <PageInteractions previewMode={previewMode}>{children}</PageInteractions>
      </CollectionInteractions>
    </InteractionsContextProvider>
  );
};

export default InteractionsSdkContextProvider;
