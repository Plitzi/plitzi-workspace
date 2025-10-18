import { ToastProvider } from '@plitzi/plitzi-ui/Toast';
import { use } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import SpaceContainerInternal from './SpaceContainerInternal';

import type { RenderMode } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type SpaceContainerProps = {
  children: ReactNode;
  renderMode?: RenderMode;
};

const SpaceContainer = ({ children, renderMode }: SpaceContainerProps) => {
  const { webId } = use(NetworkContext);

  return (
    <ToastProvider containerId={renderMode === 'ssr' ? `toast-container-${webId}` : undefined}>
      <SpaceContainerInternal>{children}</SpaceContainerInternal>
    </ToastProvider>
  );
};

export default SpaceContainer;
