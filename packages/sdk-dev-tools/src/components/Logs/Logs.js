// Packages
import React from 'react';

// Relatives
import Log from './Log';

/**
 * @param {{
 *   className?: string;
 *   items: object[];
 * }} props
 * @returns {React.ReactElement}
 */
const Logs = props => {
  const { items = [] } = props;

  return (
    <div className="flex flex-col w-full">
      {items && items.map((item, i) => <Log key={i} {...item} message={item.message} />)}
    </div>
  );
};

export default Logs;
