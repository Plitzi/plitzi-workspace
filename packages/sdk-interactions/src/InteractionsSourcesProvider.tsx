import { use } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import InteractionsContextProvider from './InteractionsContextProvider';
import AuthInteractions from './sources/AuthSource/AuthInteractions';
import NavigationInteractions from './sources/NavigationSource/NavigationInteractions';
import StateInteractions from './sources/StateSource/StateInteractions';

import type { ReactNode } from 'react';

export type InteractionsSourcesProviderProps = {
  children?: ReactNode;
  previewMode?: boolean;
};

const InteractionsSourcesProvider = ({ children, previewMode = false }: InteractionsSourcesProviderProps) => {
  const { currentPageId, routeParams, queryParams } = use(NavigationContext);
  const [userProvider = 'basic'] = useCommonStore('schema.settings.userProvider');

  return (
    <InteractionsContextProvider currentPageId={currentPageId} routeParams={routeParams} queryParams={queryParams}>
      <AuthInteractions authProvider={userProvider}>
          <StateInteractions>
            <NavigationInteractions previewMode={previewMode}>{children}</NavigationInteractions>
          </StateInteractions>
      </AuthInteractions>
    </InteractionsContextProvider>
  );
};

export default InteractionsSourcesProvider;
