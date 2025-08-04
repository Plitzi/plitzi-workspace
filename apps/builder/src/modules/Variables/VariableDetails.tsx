import { QueryBuilderFormatter } from '@plitzi/plitzi-ui/QueryBuilder';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import { useCallback } from 'react';

import VariableValue from './VariableValue';

import type { SchemaVariable } from '@plitzi/sdk-shared';

export type VariableDetailsProps = {
  name?: SchemaVariable['name'];
  type?: SchemaVariable['type'];
  subValues?: SchemaVariable['subValues'];
};

const VariableDetails = ({ name, subValues = [], type = 'text' }: VariableDetailsProps) => {
  const { addToast } = useToast();

  const handleClickCopy = useCallback(() => {
    void navigator.clipboard.writeText(`{{${name}}}`);
    addToast('Variable copied into the clipboard', {
      appeareance: 'success',
      autoDismiss: true,
      placement: 'top-right'
    });
  }, [addToast, name]);

  return (
    <div className="flex w-full flex-col gap-2">
      {subValues.length > 0 && (
        <div className="flex w-full flex-col gap-1">
          {subValues.map((subValue, index) => (
            <div key={index} className="flex w-full flex-col rounded-sm border border-gray-300 text-xs">
              <div className="flex items-center gap-1 px-1 py-0.5">
                <div className="font-bold">Value:</div>
                <VariableValue className="text-xs" value={subValue.value} type={type} />
              </div>
              <div className="flex gap-1 border-t border-gray-300 px-1 py-0.5">
                <div className="font-bold">When:</div>
                {QueryBuilderFormatter(subValue.when)}
              </div>
            </div>
          ))}
        </div>
      )}
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
