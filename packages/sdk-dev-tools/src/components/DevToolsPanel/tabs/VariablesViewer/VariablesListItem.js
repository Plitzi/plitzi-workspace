// Packags
import React from 'react';

// Relatives
import VariableValue from './VariableValue.js';

/**
 * @param {{
 *   className?: string;
 *   name?: string;
 *   type?: string;
 *   value: string | number | boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const VariablesListItem = props => {
  const { name, type, value } = props;

  return (
    <div className="flex justify-between px-2 py-1 hover:bg-gray-100">
      <div className="flex gap-2 items-center">
        <div className="font-bold">{name}</div>
        <div className="text-sm">({type})</div>
      </div>
      <div className="flex gap-1">
        <VariableValue value={value} type={type} />
      </div>
    </div>
  );
};

export default VariablesListItem;
