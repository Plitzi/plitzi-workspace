// Packages
import { use } from 'react';

// Monorepo
import useDataSource from '@plitzi/sdk-data-source/hooks/useDataSource';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';

// Relatives
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
