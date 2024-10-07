// Packages
import React, { useCallback } from 'react';
import useToast from '@plitzi/plitzi-ui-components/Toast/useToast';
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
  const { addToast } = useToast();

  const handleClickCopy = useCallback(() => {
    if (!navigator) {
      return;
    }

    navigator.clipboard.writeText(`{{${name}}}`);
    addToast('Variable copied into the clipboard', {
      appeareance: 'success',
      autoDismiss: true,
      placement: 'top-right'
    });
  }, [name]);

  return (
    <div className="flex flex-col w-full gap-2">
      <div className="flex flex-col gap-1 w-full">
        {subValues.length > 0 && <div className="font-bold text-sm mt-2">Variations:</div>}
        {subValues.map((subValue, index) => (
          <div key={index} className="flex flex-col gap-1 text-xs border border-gray-300 rounded w-full">
            <div className="flex gap-1 px-1">
              <div className="font-bold">Value:</div>
              <VariableValue className="text-xs" value={subValue.value} type={type} />
            </div>
            <div className="flex gap-1 px-1 border-t border-gray-300">
              <div className="font-bold">When:</div>
              {QueryBuilderFormatter(subValue.when)}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          As Token:
          <div className="truncate font-bold" title={name}>
            {`{{${name}}}`}
          </div>
        </div>
        <i className="fa-solid fa-copy cursor-pointer hover:text-blue-400" onClick={handleClickCopy} title="Copy" />
      </div>
    </div>
  );
};

export default VariableDetails;

// reducir el tamano de las variables
// pensaba usar el icono q use en devTools de branch para simular las variantes del valor
// tomar en cuenta q debe soportar facil 100 variables o mas
