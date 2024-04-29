// Packages
import React, { useMemo } from 'react';

// Relatives
import SpaceContext from './SpaceContext';

export const STYLE_TYPE_NORMAL = 'normal';
export const STYLE_TYPE_PARTIAL = 'partial';
export const STYLE_TYPE_TEMPLATE = 'template';
export const STYLE_TYPE_SEGMENT = 'segment';

/**
 * @param {{
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const SpaceContextProvider = props => {
  const { children } = props;

  const valueMemo = useMemo(() => ({}), []);

  return <SpaceContext value={valueMemo}>{children}</SpaceContext>;
};

export default SpaceContextProvider;
