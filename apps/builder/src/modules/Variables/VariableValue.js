// Packages
import React from 'react';

/**
 * @param {{
 *   value?: string;
 *   type?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const VariableValue = props => {
  const { type, value } = props;

  return (
    <div className="flex gap-1 items-center text-xs">
      {type === 'color' && <div className="min-w-2.5 min-h-2.5 rounded" title={value} style={{ backgroundColor: value }} />}
      <div className="truncate" title={value}>
        {value}
      </div>
    </div>
  );
};

export default VariableValue;
