import { QueryBuilderEvaluator } from '@plitzi/plitzi-ui/QueryBuilder';
import { useCallback, use, useMemo } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import DataSourceContext from '@plitzi/sdk-shared/dataSource/DataSourceContext';
import { getPathsFromObeject } from '@plitzi/sdk-shared/helpers/utils';
import { createStoreHook } from '@plitzi/sdk-shared/store';

import type { CommonState, SchemaVariable } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type VariablesSourceProps = {
  children?: ReactNode;
  environment: string;
};

const VariablesSource = ({ children, environment }: VariablesSourceProps) => {
  const { useDataSource } = use(DataSourceContext);
  const { useStore } = createStoreHook<CommonState>();
  const [variables] = useStore('schema.variables');
  const { routeParams, queryParams, hostname } = use(NavigationContext);
  const whenData = useMemo(
    () => ({ routeParams, queryParams, hostname, environment }),
    [routeParams, queryParams, hostname, environment]
  );

  const variablesParsed = useMemo<Record<string, unknown>>(() => {
    if (!(variables as SchemaVariable[] | undefined)) {
      return {};
    }

    return variables.reduce<Record<string, unknown>>((acum, variable) => {
      const { name, value, subValues } = variable;
      if (!Array.isArray(subValues) || subValues.length === 0) {
        return { ...acum, [name]: value };
      }

      const subValue = subValues.find(subValue => QueryBuilderEvaluator(subValue.when, whenData));
      if (subValue) {
        return { ...acum, [name]: subValue.value };
      }

      return { ...acum, [name]: value };
    }, {});
  }, [variables, whenData]);

  const sourceFields = useCallback(
    () => [
      ...getPathsFromObeject(variablesParsed).reduce<{ path: string; name: string }[]>(
        (acum, path) => [...acum, { path, name: `variables.${path}` }],
        []
      )
    ],
    [variablesParsed]
  );

  const [VariablesSourceContext] = useDataSource({
    id: 'global',
    source: 'variables',
    mode: 'write',
    name: 'Variables',
    fields: sourceFields
  });

  return <VariablesSourceContext value={variablesParsed}>{children}</VariablesSourceContext>;
};

export default VariablesSource;
