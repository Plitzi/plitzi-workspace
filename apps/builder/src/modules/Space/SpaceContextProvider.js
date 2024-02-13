// Packages
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

// Relatives
import SpaceContext from './SpaceContext';

export const STYLE_TYPE_NORMAL = 'normal';
export const STYLE_TYPE_PARTIAL = 'partial';
export const STYLE_TYPE_TEMPLATE = 'template';
export const STYLE_TYPE_SEGMENT = 'segment';

const SpaceContextProvider = props => {
  const { children } = props;

  const valueMemo = useMemo(() => ({}), []);

  return <SpaceContext.Provider value={valueMemo}>{children}</SpaceContext.Provider>;
};

SpaceContextProvider.propTypes = {
  children: PropTypes.node
};

export default SpaceContextProvider;
