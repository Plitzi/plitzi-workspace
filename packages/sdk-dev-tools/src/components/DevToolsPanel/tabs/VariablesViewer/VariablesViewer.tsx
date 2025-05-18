import { use } from 'react';

import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import useDataSource from '@plitzi/sdk-shared/dataSource/hooks/useDataSource';

import VariablesList from './VariablesList';

const VariablesViewer = () => {
  const {
    schema: { variables }
  } = use(SchemaContext);
  const { variables: variablesParsed } = useDataSource<Record<string, string>>({ id: '', mode: 'read' });

  return (
    <div className="flex w-full">
      <VariablesList variables={variables} variablesParsed={variablesParsed} />
    </div>
  );
};

export default VariablesViewer;
