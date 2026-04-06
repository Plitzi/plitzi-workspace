import Heading from '@plitzi/plitzi-ui/Heading';

import useDataSource from '@plitzi/sdk-shared/dataSource/hooks/useDataSource';
import { createStoreHook } from '@plitzi/sdk-shared/store';

import VariablesList from './VariablesList';
import VariablesStyleList from './VariablesStyleList';

import type { CommonState } from '@plitzi/sdk-shared';

const VariablesViewer = () => {
  const { useStore } = createStoreHook<CommonState>();
  const [[variables, styleVariables]] = useStore(['schema.variables', 'style.variables']);
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
