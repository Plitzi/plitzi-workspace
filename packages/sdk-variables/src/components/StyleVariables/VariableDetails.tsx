import { useToast } from '@plitzi/plitzi-ui/Toast';
import { useCallback } from 'react';

import type { SchemaVariable } from '@plitzi/sdk-shared';

export type VariableDetailsProps = {
  name?: SchemaVariable['name'];
  type?: SchemaVariable['type'];
};

const VariableDetails = ({ name }: VariableDetailsProps) => {
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
    <div className="flex w-full items-center justify-between gap-2">
      <div className="flex gap-1">
        Token:
        <div className="truncate font-bold" title={name}>
          {`var(--${name})`}
        </div>
      </div>
      <i className="fa-solid fa-copy cursor-pointer hover:text-blue-400" onClick={handleClickCopy} title="Copy" />
    </div>
  );
};

export default VariableDetails;
