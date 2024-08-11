// Packages
import React from 'react';

/**
 * @param {{
 *   className?: string;
 *   message?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const Log = props => {
  const { message } = props;

  return <div className="w-full border-b last:border-b-none border-gray-300 px-2 py-1">{message}</div>;
};

export default Log;
