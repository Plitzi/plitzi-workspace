// Packages
import React from 'react';
import classNames from 'classnames';

/**
 * @param {{
 *   className?: string;
 *   value?: string;
 *   type?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const VariableValue = props => {
  const { className = '', type, value } = props;

  return (
    <div className={classNames('flex gap-1 items-center', className)}>
      {type === 'color' && (
        <div className="min-w-2.5 min-h-2.5 rounded" title={value} style={{ backgroundColor: value }} />
      )}
      <div className="truncate" title={value}>
        {value}
      </div>
    </div>
  );
};

export default VariableValue;
