// Packages
import React, { useCallback, use, useMemo } from 'react';

// Monorepo
import DataSourceContext from '@plitzi/sdk-data-source/DataSourceContext';
import { getPathsFromObeject } from '@plitzi/sdk-shared/utils';

/**
 * @param {{
 *   children: React.ReactNode;
 *   variables: {
 *     name: string;
 *     value: string;
 *   }[];
 * }} props
 * @returns {React.ReactElement}
 */
const VariablesSource = props => {
  const { children, variables = [] } = props;
  const { useDataSource } = use(DataSourceContext);

  const variablesParsed = useMemo(() => {
    return variables.reduce((acum, variable) => {
      const { name, value } = variable;

      return { ...acum, [name]: value };
    }, {});
  }, [variables]);

  const sourceFields = useCallback(
    async () => [...getPathsFromObeject(variablesParsed).reduce((acum, path) => [...acum, { path, name: path }], [])],
    [variablesParsed]
  );

  const [VariablesSourceContext] = useDataSource({
    id: 'global',
    source: 'variables',
    name: 'Variables',
    fields: sourceFields
  });

  return <VariablesSourceContext value={variablesParsed}>{children}</VariablesSourceContext>;
};

export default VariablesSource;
