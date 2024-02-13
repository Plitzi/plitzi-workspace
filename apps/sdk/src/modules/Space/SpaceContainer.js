// Packages
import React from 'react';
import PropTypes from 'prop-types';
import ToastProvider from '@plitzi/plitzi-ui-components/Toast/ToastProvider';

// Relatives
import SpaceContainerInternal from './SpaceContainerInternal';

const SpaceContainer = props => {
  const { children } = props;

  return (
    <ToastProvider>
      <SpaceContainerInternal>{children}</SpaceContainerInternal>
    </ToastProvider>
  );
};

SpaceContainer.propTypes = {
  children: PropTypes.node
};

export default SpaceContainer;
