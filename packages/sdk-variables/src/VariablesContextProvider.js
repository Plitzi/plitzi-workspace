// Packages
import React, { useMemo } from 'react';

// Relatives
import VariablesContext from './VariablesContext';

/**
 * @param {{
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const VariablesContextProvider = props => {
  const { children } = props;

  const valueMemo = useMemo(() => ({}), []);

  return <VariablesContext value={valueMemo}>{children}</VariablesContext>;
};

export default VariablesContextProvider;
