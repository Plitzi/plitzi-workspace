import { ToastProvider } from '@plitzi/plitzi-ui/Toast';
import { use } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import SpaceContainerInternal from './SpaceContainerInternal';

import type { ReactNode } from 'react';

export type SpaceContainerProps = {
  children: ReactNode;
};

const SpaceContainer = ({ children }: SpaceContainerProps) => {
  const { webId } = use(NetworkContext);

  return (
    // `plitzi-sdk-toasts` is what lifts them above the dev-tools panel — see the SDK stylesheet.
    <ToastProvider containerId={`toast-container-${webId}`} classNameContainer="plitzi-sdk-toasts">
      <SpaceContainerInternal>{children}</SpaceContainerInternal>
    </ToastProvider>
  );
};

export default SpaceContainer;
