import { use } from 'react';

import InteractionsContextProvider from '@plitzi/sdk-interactions/InteractionsContextProvider';
import UserInteractions from '@plitzi/sdk-interactions/sources/UserSource/UserInteractions';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import SchemaSettingsContext from '@plitzi/sdk-schema/SchemaSettingsContext';

import CollectionInteractions from './sources/CollectionSource/CollectionInteractions';
import PageInteractions from './sources/PageSource/PageInteractions';

import type { ReactNode } from 'react';

export type InteractionsBuilderContextProviderProps = {
  children?: ReactNode;
  previewMode?: boolean;
};

const InteractionsBuilderContextProvider = ({
  children,
  previewMode = true
}: InteractionsBuilderContextProviderProps) => {
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

export default InteractionsBuilderContextProvider;
