// Packages
import React from 'react';
import QueryBuilderFormatter from '@plitzi/plitzi-ui-components/QueryBuilder/helpers/QueryBuilderFormatter';

// Relatives
import VariableValue from './VariableValue';

/**
 * @param {{
 *   name?: string;
 *   type?: string;
 *   subValues?: [{ value: string; when: object }];
 * }} props
 * @returns {React.ReactElement}
 */
const VariableDetails = props => {
  const { name, subValues = [], type = 'text' } = props;

  return (
    <div className="flex flex-col w-full mt-2 gap-4">
      <div className="flex flex-col gap-1 w-full">
        {subValues.length > 0 && <div className="font-bold text-sm">Variations:</div>}
        {subValues.map((subValue, index) => (
          <div key={index} className="flex flex-col gap-1 text-xs border border-gray-300 rounded w-full">
            <div className="flex gap-1 px-1">
              <div className="font-bold">Value:</div>
              <VariableValue value={subValue.value} type={type} />
            </div>
            <div className="flex gap-1 px-1 border-t border-gray-300">
              <div className="font-bold">When:</div>
              {QueryBuilderFormatter(subValue.when)}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        As Token:
        <div className="truncate font-bold" title={name}>
          {`{{${name}}}`}
        </div>
      </div>
    </div>
  );
};

export default VariableDetails;

// reducir el tamano de las variables
// pensaba usar el icono q use en devTools de branch para simular las variantes del valor
// tomar en cuenta q debe soportar facil 100 variables o mas
