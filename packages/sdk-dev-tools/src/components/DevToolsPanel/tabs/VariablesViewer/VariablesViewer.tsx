import Heading from '@plitzi/plitzi-ui/Heading';
import { use } from 'react';

import useDataSource from '@plitzi/sdk-shared/dataSource/hooks/useDataSource';
import SchemaContext from '@plitzi/sdk-shared/schema/SchemaContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';

import VariablesList from './VariablesList';
import VariablesStyleList from './VariablesStyleList';

const VariablesViewer = () => {
  const {
    schema: { variables }
  } = use(SchemaContext);
  const {
    style: { variables: styleVariables }
  } = use(StyleContext);
  const { variables: variablesParsed } = useDataSource<Record<string, string>>({ id: '', mode: 'read' });

  return (
    <div className="flex w-full flex-col p-2">
      <Heading as="h4">Schema Variables</Heading>
      <VariablesList variables={variables} variablesParsed={variablesParsed} />
      <Heading as="h4">Style Variables</Heading>
      <VariablesStyleList variables={styleVariables} />
    </div>
  );
};

export default VariablesViewer;
