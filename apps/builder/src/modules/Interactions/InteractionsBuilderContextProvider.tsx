import { use } from 'react';

import InteractionsContextProvider from '@plitzi/sdk-interactions/InteractionsContextProvider';
import AuthInteractions from '@plitzi/sdk-interactions/sources/AuthSource/AuthInteractions';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import { createStoreHook } from '@plitzi/sdk-shared';

import CollectionInteractions from './sources/CollectionSource/CollectionInteractions';
import PageInteractions from './sources/PageSource/PageInteractions';

import type { BuilderState } from '@plitzi/sdk-shared';
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
  const { useStore } = createStoreHook<BuilderState>();
  const [userProvider = 'basic'] = useStore('schema.settings.userProvider');

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

export default InteractionsBuilderContextProvider;
