// Packages
import React, { use } from 'react';

// Monorepo
import InteractionsContextProvider from '@plitzi/sdk-interactions/InteractionsContextProvider';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import UserInteractions from '@plitzi/sdk-interactions/sources/UserSource/UserInteractions';
import SchemaSettingsContext from '@plitzi/sdk-schema/SchemaSettingsContext';

// Alias
import CollectionInteractions from './sources/CollectionSource/CollectionInteractions';
import PageInteractions from './sources/PageSource/PageInteractions';

/**
 * @param {{
 *   children: React.ReactNode;
 *   previewMode?: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const InteractionsSdkContextProvider = props => {
  const { children, previewMode = false } = props;
  const { currentPageId, routeParams, queryParams } = use(NavigationContext);
  const { userProvider } = use(SchemaSettingsContext);

  return (
    <InteractionsContextProvider currentPageId={currentPageId} routeParams={routeParams} queryParams={queryParams}>
      <UserInteractions userProvider={userProvider}>
        <CollectionInteractions>
          <PageInteractions previewMode={previewMode}>{children}</PageInteractions>
        </CollectionInteractions>
      </UserInteractions>
    </InteractionsContextProvider>
  );
};

export default InteractionsSdkContextProvider;
