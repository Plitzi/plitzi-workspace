import { useSdkStore, useRenderSettings } from '@plitzi/sdk-shared/store';

import InteractionsContextProvider from './InteractionsContextProvider';
import ActionInteractions from './sources/ActionsSource/ActionInteractions';
import AuthInteractions from './sources/AuthSource/AuthInteractions';
import HostInteractions from './sources/HostSource/HostInteractions';
import NavigationInteractions from './sources/NavigationSource/NavigationInteractions';
import StateInteractions from './sources/StateSource/StateInteractions';

import type { HostActions } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type InteractionsSourcesProviderProps = {
  children?: ReactNode;
  /** What the embedding application is willing to be asked to do — see {@link HostActions}. */
  hostActions?: HostActions;
};

const InteractionsSourcesProvider = ({ children, hostActions }: InteractionsSourcesProviderProps) => {
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
            <NavigationInteractions previewMode={previewMode}>
              <HostInteractions actions={hostActions}>{children}</HostInteractions>
            </NavigationInteractions>
          </ActionInteractions>
        </StateInteractions>
      </AuthInteractions>
    </InteractionsContextProvider>
  );
};

export default InteractionsSourcesProvider;
