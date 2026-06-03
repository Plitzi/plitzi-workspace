import { get } from '@plitzi/plitzi-ui/helpers';
import { QueryBuilderEvaluator } from '@plitzi/plitzi-ui/QueryBuilder';
import { useCallback, use, useMemo } from 'react';

import AuthContext from '@plitzi/sdk-auth/AuthContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import useRegisterSource from '@plitzi/sdk-shared/dataSource/hooks/useRegisterSource';
import { getPathsFromObeject } from '@plitzi/sdk-shared/helpers/utils';
import StateManagerContext from '@plitzi/sdk-state/StateManagerContext';
import { createStoreHook } from '@plitzi/sdk-store/createStore';

import type { CommonState, SchemaVariable, SourceField } from '@plitzi/sdk-shared';

export type UseGlobalSourcesProps = {
  environment?: string;
};

// Projects the global data sources (variables, navigation, auth, page) into the store: each publishes its value
// to `runtime.sources.*` and registers its `fields` metadata into the `sources` slice for the builder editor. No
// React Context — the store is the single source of truth. Must run under the Navigation/Auth/StateManager providers.
const useGlobalSources = ({ environment = 'main' }: UseGlobalSourcesProps = {}) => {
  const { useStore, useStoreSync } = createStoreHook<CommonState>();
  const { routeParams, queryParams, hostname, currentPageId } = use(NavigationContext);

  // --- variables ---
  const [variables] = useStore('schema.variables');
  const whenData = useMemo(
    () => ({ routeParams, queryParams, hostname, environment }),
    [routeParams, queryParams, hostname, environment]
  );
  const variablesValue = useMemo<Record<string, unknown>>(() => {
    if (!(variables as SchemaVariable[] | undefined)) {
      return {};
    }

    return variables.reduce<Record<string, unknown>>((acum, variable) => {
      const { name, value, subValues } = variable;
      if (!Array.isArray(subValues) || subValues.length === 0) {
        return { ...acum, [name]: value };
      }

      const subValue = subValues.find(subValue => QueryBuilderEvaluator(subValue.when, whenData));

      return { ...acum, [name]: subValue ? subValue.value : value };
    }, {});
  }, [variables, whenData]);
  const variablesFields = useCallback(
    () => getPathsFromObeject(variablesValue).map(path => ({ path, name: `variables.${path}` })),
    [variablesValue]
  );
  useRegisterSource({ id: 'global', source: 'variables', name: 'Variables', fields: variablesFields });
  useStoreSync('runtime.sources.variables', variablesValue);

  // --- navigation ---
  const navigationValue = useMemo(() => ({ routeParams, queryParams }), [routeParams, queryParams]);
  const navigationFields = useCallback(
    () => getPathsFromObeject({ routeParams, queryParams }).map(path => ({ path, name: `navigation.${path}` })),
    [routeParams, queryParams]
  );
  useRegisterSource({ id: 'global', source: 'navigation', name: 'Navigation', fields: navigationFields });
  useStoreSync('runtime.sources.navigation', navigationValue);

  // --- auth ---
  const { user, authenticated } = use(AuthContext);
  const [userProvider = 'basic'] = useStore('schema.settings.userProvider');
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
  useStoreSync('runtime.sources.auth', authValue);

  // --- page ---
  const { state } = use(StateManagerContext);
  const [pageDefinitions = {}] = useStore('pageDefinitions');
  const pages = useMemo(
    () =>
      Object.values(pageDefinitions).map(page => ({ value: page.id, label: get(page, 'attributes.name', page.id) })),
    [pageDefinitions]
  );
  const pageValue = useMemo(() => ({ ...state, currentPageId }), [state, currentPageId]);
  const pageFields = useCallback(() => {
    const fields = getPathsFromObeject(state).map(path => ({ path, name: `page.${path}` })) as SourceField[];
    const currentPageField =
      pages.length > 0
        ? ({ path: 'currentPageId', name: 'Current Page', inputType: 'select', values: pages } as SourceField)
        : { path: 'currentPageId', name: 'Current Page' };

    return [...fields, currentPageField];
  }, [state, pages]);
  useRegisterSource({ id: 'global', source: 'page', name: 'Page', fields: pageFields });
  useStoreSync('runtime.sources.page', pageValue);
};

export default useGlobalSources;
