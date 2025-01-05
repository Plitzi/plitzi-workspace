// Packages
import React, { useCallback, use, useMemo } from 'react';
import QueryBuilderEvaluator from '@plitzi/plitzi-ui/QueryBuilder/helpers/QueryBuilderEvaluator.es';

// Monorepo
import { getPathsFromObeject } from '@plitzi/sdk-shared/utils';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';

// Relatives
import DataSourceContext from '../DataSourceContext.js';

/**
 * @param {{
 *   children: React.ReactNode;
 *   environment: string;
 * }} props
 * @returns {React.ReactElement}
 */
const VariablesSource = props => {
  const { children, environment } = props;
  const { useDataSource } = use(DataSourceContext);
  const {
    schema: { variables }
  } = use(SchemaContext);
  const { routeParams, queryParams, hostname } = use(NavigationContext);
  const whenData = useMemo(
    () => ({ routeParams, queryParams, hostname, environment }),
    [routeParams, queryParams, hostname, environment]
  );

  const variablesParsed = useMemo(() => {
    return (
      variables?.reduce((acum, variable) => {
        const { name, value, subValues } = variable;
        if (!Array.isArray(subValues) || subValues.length === 0) {
          return { ...acum, [name]: value };
        }

        const subValue = subValues.find(subValue => QueryBuilderEvaluator(subValue.when, whenData));
        if (subValue) {
          return { ...acum, [name]: subValue.value };
        }

        return { ...acum, [name]: value };
      }, {}) ?? {}
    );
  }, [variables, whenData]);

  const sourceFields = useCallback(
    async () => [
      ...getPathsFromObeject(variablesParsed).reduce((acum, path) => [...acum, { path, name: `variables.${path}` }], [])
    ],
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
