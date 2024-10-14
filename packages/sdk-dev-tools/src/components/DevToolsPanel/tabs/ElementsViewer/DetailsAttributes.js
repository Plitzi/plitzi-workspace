// Packages
import React from 'react';
import classNames from 'classnames';

// Relatives
import DetailsValue from './DetailsValue.js';

/**
 * @param {{
 *   className?: string;
 *   attributes?: object;
 * }} props
 * @returns {React.ReactElement}
 */
const DetailsAttributes = props => {
  const { className, attributes } = props;

  return (
    <div className={classNames('w-full  text-sm', className)}>
      {Object.entries(attributes).map(([key, value], i) => (
        <div key={i} className="flex gap-4 not-first:border-t border-gray-300">
          <div className="grow basis-0">{key}</div>
          <DetailsValue isAttribute className="grow basis-0 truncate" attribute={key} value={value} />
        </div>
      ))}
    </div>
  );
};

export default DetailsAttributes;
