// Packags
import React from 'react';

// Relatives
import VariablesListItem from './VariablesListItem.js';

/**
 * @param {{
 *   className?: string;
 *   variables?: object[];
 *   variablesParsed?: string[] | number[];
 * }} props
 * @returns {React.ReactElement}
 */
const VariablesList = props => {
  const { variables, variablesParsed } = props;

  return (
    <div className="flex flex-col w-full">
      {variables.map((variable, i) => (
        <VariablesListItem key={i} name={variable.name} type={variable.type} value={variablesParsed[variable.name]} />
      ))}
    </div>
  );
};

export default VariablesList;
