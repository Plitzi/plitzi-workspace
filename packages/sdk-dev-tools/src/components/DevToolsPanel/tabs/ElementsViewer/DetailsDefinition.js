// Packages
import React from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';

// Relatives
import DetailsValue from './DetailsValue';

/**
 * @param {{
 *   className?: string;
 *   definition?: object;
 *   onSelectElement: (id: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const DetailsDefinition = props => {
  const { className, definition, onSelectElement = noop } = props;

  return (
    <div className={classNames('w-full  text-sm', className)}>
      {Object.entries(definition).map(([key, value], i) => (
        <div key={i} className="flex gap-4 not-first:border-t border-gray-300">
          <div className="grow basis-0">{key}</div>
          <DetailsValue
            isDefinition
            className="grow basis-0 truncate"
            attribute={key}
            value={value}
            onSelectElement={onSelectElement}
          />
        </div>
      ))}
    </div>
  );
};

export default DetailsDefinition;
