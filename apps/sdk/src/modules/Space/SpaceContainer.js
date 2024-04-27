// Packages
import React from 'react';
import ToastProvider from '@plitzi/plitzi-ui-components/Toast/ToastProvider';

// Relatives
import SpaceContainerInternal from './SpaceContainerInternal';

/**
 * @param {{
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const SpaceContainer = props => {
  const { children } = props;

  return (
    <ToastProvider>
      <SpaceContainerInternal>{children}</SpaceContainerInternal>
    </ToastProvider>
  );
};

export default SpaceContainer;
