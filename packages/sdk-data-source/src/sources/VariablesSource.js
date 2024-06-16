// Packages
import React, { useCallback, use, useMemo } from 'react';
import QueryBuilderEvaluator from '@plitzi/plitzi-ui-components/QueryBuilder/helpers/QueryBuilderEvaluator';

// Monorepo
import DataSourceContext from '@plitzi/sdk-data-source/DataSourceContext';
import { emptyObject, getPathsFromObeject } from '@plitzi/sdk-shared/utils';

/**
 * @param {{
 *   children: React.ReactNode;
 *   variables: {
 *     name: string;
 *     value: string;
 *   }[];
 *   whenData: {
 *     [key: string]: any;
 *   };
 * }} props
 * @returns {React.ReactElement}
 */
const VariablesSource = props => {
  const { children, variables = [], whenData = emptyObject } = props;
  const { useDataSource } = use(DataSourceContext);

  const variablesParsed = useMemo(() => {
    return variables.reduce((acum, variable) => {
      const { name, value, when, whenSuccessValue, whenFailValue } = variable;
      if (!when) {
        return { ...acum, [name]: value };
      }

      if (QueryBuilderEvaluator(when, whenData)) {
        return { ...acum, [name]: !whenSuccessValue ? value : whenSuccessValue };
      }

      return { ...acum, [name]: !whenFailValue ? value : whenFailValue };
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
