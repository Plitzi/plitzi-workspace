// Packages
import React, { use } from 'react';
import classNames from 'classnames';

// Monorepo
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import useDataSource from '@plitzi/sdk-data-source/hooks/useDataSource';

// Relatives
import VariablesList from './VariablesList.js';

/**
 * @param {{
 *   className?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const VariablesViewer = props => {
  const { className } = props;
  const {
    schema: { variables }
  } = use(SchemaContext);
  const { variables: variablesParsed } = useDataSource({ id: '', mode: 'read' });

  return (
    <div className={classNames('flex w-full', className)}>
      <VariablesList variables={variables} variablesParsed={variablesParsed} />
    </div>
  );
};

export default VariablesViewer;
