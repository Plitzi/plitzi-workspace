import { useSdkStore, useRenderSettings } from '@plitzi/sdk-shared/store';

import InteractionsContextProvider from './InteractionsContextProvider';
import ActionInteractions from './sources/ActionsSource/ActionInteractions';
import AuthInteractions from './sources/AuthSource/AuthInteractions';
import NavigationInteractions from './sources/NavigationSource/NavigationInteractions';
import StateInteractions from './sources/StateSource/StateInteractions';

import type { ReactNode } from 'react';

export type InteractionsSourcesProviderProps = {
  children?: ReactNode;
};

const InteractionsSourcesProvider = ({ children }: InteractionsSourcesProviderProps) => {
  const [[userProvider = 'basic', routeParams, queryParams, currentPageId]] = useSdkStore([
    'schema.settings.userProvider',
    'navigation.routeParams',
    'navigation.queryParams',
    'navigation.currentPageId'
  ]);
  const { previewMode } = useRenderSettings();

  return (
    <InteractionsContextProvider currentPageId={currentPageId} routeParams={routeParams} queryParams={queryParams}>
      <AuthInteractions authProvider={userProvider}>
        <StateInteractions>
          <ActionInteractions>
            <NavigationInteractions previewMode={previewMode}>{children}</NavigationInteractions>
          </ActionInteractions>
        </StateInteractions>
      </AuthInteractions>
    </InteractionsContextProvider>
  );
};

export default InteractionsSourcesProvider;
