import { get } from '@plitzi/plitzi-ui/helpers';
import { QueryBuilderEvaluator } from '@plitzi/plitzi-ui/QueryBuilder';
import { useCallback, use, useMemo } from 'react';

import AuthContext from '@plitzi/sdk-auth/AuthContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import useRegisterSource from '@plitzi/sdk-shared/dataSource/hooks/useRegisterSource';
import { getPathsFromObeject } from '@plitzi/sdk-shared/helpers/utils';
import { useCommonStore, useCommonStoreSync } from '@plitzi/sdk-shared/store';

import type { SchemaVariable, SourceField } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type GlobalSourcesProps = {
  children: ReactNode;
  environment?: string;
};

// Mounts the global data sources at the right tree depth (under the Navigation/Auth/RuntimeState providers).
const GlobalSources = ({ children, environment = 'main' }: GlobalSourcesProps) => {
  const { routeParams, queryParams, hostname, currentPageId } = use(NavigationContext);

  // --- variables ---
  const [variables] = useCommonStore('schema.variables');
  const variablesValue = useMemo<Record<string, unknown>>(() => {
    if (!(variables as SchemaVariable[] | undefined)) {
      return {};
    }

    return variables.reduce<Record<string, unknown>>((acum, variable) => {
      const { name, value, subValues } = variable;
      if (!Array.isArray(subValues) || subValues.length === 0) {
        return { ...acum, [name]: value };
      }

      const whenData = { routeParams, queryParams, hostname, environment };
      const subValue = subValues.find(subValue => QueryBuilderEvaluator(subValue.when, whenData));

      return { ...acum, [name]: subValue ? subValue.value : value };
    }, {});
  }, [environment, hostname, queryParams, routeParams, variables]);
  const variablesFields = useCallback(
    () => getPathsFromObeject(variablesValue).map(path => ({ path, name: `variables.${path}` })),
    [variablesValue]
  );
  useRegisterSource({ id: 'global', source: 'variables', name: 'Variables', fields: variablesFields });
  useCommonStoreSync('runtime.sources.variables', variablesValue);

  // --- navigation ---
  const [pageDefinitions = {}] = useCommonStore('pageDefinitions');
  const pages = useMemo(
    () =>
      Object.values(pageDefinitions).map(page => ({ value: page.id, label: get(page, 'attributes.name', page.id) })),
    [pageDefinitions]
  );
  const navigationValue = useMemo(
    () => ({ routeParams, queryParams, currentPageId }),
    [routeParams, queryParams, currentPageId]
  );
  const navigationFields = useCallback(() => {
    const fields = getPathsFromObeject({ routeParams, queryParams }).map(path => ({
      path,
      name: `navigation.${path}`
    })) as SourceField[];
    const currentPageField =
      pages.length > 0
        ? ({ path: 'currentPageId', name: 'Current Page', inputType: 'select', values: pages } as SourceField)
        : ({ path: 'currentPageId', name: 'Current Page' } as SourceField);

    return [...fields, currentPageField];
  }, [routeParams, queryParams, pages]);
  useRegisterSource({ id: 'global', source: 'navigation', name: 'Navigation', fields: navigationFields });
  useCommonStoreSync('runtime.sources.navigation', navigationValue);

  // --- auth ---
  const { user, authenticated } = use(AuthContext);
  const [userProvider = 'basic'] = useCommonStore('schema.settings.userProvider');
  const authValue = useMemo<Record<string, unknown>>(() => {
    switch (userProvider) {
      case 'auth0':
        return {
          isAuthenticated: authenticated,
          user: {
            given_name: '',
            family_name: '',
            nickname: '',
            name: '',
            picture: '',
            locale: '',
            updated_at: '',
            email: '',
            email_verified: false,
            sub: '',
            ...user
          }
        };

      case 'basic':
        return {
          isAuthenticated: authenticated,
          accessToken: user?.accessToken ?? '',
          details: {
            username: '',
            email: '',
            roles: '',
            permissions: '',
            verified: '',
            ...(user?.details ?? {})
          }
        };

      default:
        return {};
    }
  }, [userProvider, user, authenticated]);
  const authFields = useCallback(
    () => getPathsFromObeject(authValue).map(path => ({ path, name: `user.${path}` })),
    [authValue]
  );
  useRegisterSource({ id: 'global', source: 'auth', name: 'Auth State', fields: authFields });
  useCommonStoreSync('runtime.sources.auth', authValue);

  // --- state (canonical runtime/application state) ---
  const [state] = useCommonStore('runtime.state');
  const stateFields = useCallback(
    () => getPathsFromObeject(state).map(path => ({ path, name: `state.${path}` })),
    [state]
  );
  useRegisterSource({ id: 'global', source: 'state', name: 'State', fields: stateFields });
  useCommonStoreSync('runtime.sources.state', state);

  return children;
};

export default GlobalSources;
