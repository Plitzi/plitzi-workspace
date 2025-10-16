import React, { use } from 'react';
import ToastProvider from '@plitzi/plitzi-ui/Toast/ToastProvider';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import SpaceContainerInternal from './SpaceContainerInternal';

/**
 * @param {{
 *   children: React.ReactNode;
 *   renderMode?: 'raw' | 'iframe' | 'shadow' | 'ssr' | 'widget';
 * }} props
 * @returns {React.ReactElement}
 */
const SpaceContainer = ({ children, renderMode }) => {
  const { webId } = use(NetworkContext);

  return (
    <ToastProvider containerId={renderMode === 'ssr' ? `toast-container-${webId}` : undefined}>
      <SpaceContainerInternal>{children}</SpaceContainerInternal>
    </ToastProvider>
  );
};

export default SpaceContainer;
