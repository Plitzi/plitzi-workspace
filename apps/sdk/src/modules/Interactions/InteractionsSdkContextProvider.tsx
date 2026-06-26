import { use } from 'react';

import InteractionsContextProvider from '@plitzi/sdk-interactions/InteractionsContextProvider';
import AuthInteractions from '@plitzi/sdk-interactions/sources/AuthSource/AuthInteractions';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import CollectionInteractions from './sources/CollectionSource/CollectionInteractions';
import PageInteractions from './sources/PageSource/PageInteractions';

import type { ReactNode } from 'react';

export type InteractionsSdkContextProviderProps = {
  children: ReactNode;
  previewMode?: boolean;
};

const InteractionsSdkContextProvider = ({ children, previewMode = false }: InteractionsSdkContextProviderProps) => {
  const { currentPageId, routeParams, queryParams } = use(NavigationContext);
  const [userProvider] = useBuilderStore('schema.settings.userProvider');

  return (
    <InteractionsContextProvider currentPageId={currentPageId} routeParams={routeParams} queryParams={queryParams}>
      <AuthInteractions authProvider={userProvider}>
        <CollectionInteractions>
          <PageInteractions previewMode={previewMode}>{children}</PageInteractions>
        </CollectionInteractions>
      </AuthInteractions>
    </InteractionsContextProvider>
  );
};

export default InteractionsSdkContextProvider;
