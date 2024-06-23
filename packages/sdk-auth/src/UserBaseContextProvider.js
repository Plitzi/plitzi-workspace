// Packages
import React, { useMemo, use } from 'react';
import get from 'lodash/get';
import { useAuth0 } from '@auth0/auth0-react';
import QueryBuilderEvaluator from '@plitzi/plitzi-ui-components/QueryBuilder/helpers/QueryBuilderEvaluator';

// Monorepo
import SchemaSettingsContext from '@plitzi/sdk-schema/SchemaSettingsContext';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';
import { processTwig } from '@plitzi/sdk-shared/twigWrapper';

// Packages
import useNavigation from '@plitzi/sdk-navigation/useNavigation';

// Relatives
import withUserProvider from './hocs/withUserProvider';
import UserContext from './UserContext';
import useAuth from './hooks/useAuth';

/**
 * @param {{
 *   previewMode: boolean;
 *   children: React.ReactNode;
 *   webId: string | number;
 *   server?: object;
 * }} props
 * @returns {React.ReactElement}
 */
const UserBaseContextProvider = props => {
  const { previewMode = true, children, webId = 0, server = emptyObject } = props;
  const {
    userProvider,
    loginUrl,
    refreshUrl,
    detailsPath = 'details',
    tokenPath = 'access_token',
    expirationTimePath = 'expire_at'
  } = use(SchemaSettingsContext);
  const {
    schema: { variables }
  } = use(SchemaContext);
  const { queryParams, hostname } = useNavigation({ server });
  let loading = false;
  switch (userProvider) {
    case 'auth0':
      loading = get(useAuth0(), 'isLoading', false) && previewMode;
      break;

    case 'basic':
    case '':
    default:
  }

  const variablesWhenData = useMemo(() => ({ queryParams, hostname }), [queryParams, hostname]);
  const variablesParsed = useMemo(() => {
    return variables.reduce((acum, variable) => {
      const { name, value, subValues } = variable;
      if (!Array.isArray(subValues) || subValues.length === 0) {
        return { ...acum, [name]: value };
      }

      const subValue = subValues.find(subValue => QueryBuilderEvaluator(subValue.when, variablesWhenData));
      if (subValue) {
        return { ...acum, [name]: subValue.value };
      }

      return { ...acum, [name]: value };
    }, {});
  }, [variables, variablesWhenData]);

  const authData = useMemo(
    () =>
      JSON.parse(
        processTwig(
          JSON.stringify({ loginUrl, refreshUrl, detailsPath, tokenPath, expirationTimePath }),
          variablesParsed
        )
      ),
    [variablesParsed, loginUrl, refreshUrl, detailsPath, tokenPath, expirationTimePath]
  );

  const { manager } = useAuth({
    provider: userProvider,
    webId,
    loginUrl,
    refreshUrl,
    detailsPath,
    tokenPath,
    expirationTimePath,
    ...authData
  });
  const valueMemo = useMemo(() => {
    if (!manager) {
      return {
        login: () => {},
        logout: () => {},
        refreshDetails: () => {},
        can: () => false,
        authenticated: false,
        user: {
          details: {},
          accessToken: ''
        }
      };
    }

    return {
      login: manager.login,
      logout: manager.logout,
      refreshDetails: manager.refreshDetails,
      can: manager.can,
      authenticated: manager.isAuthenticated || !previewMode,
      user: {
        details: manager.userDetails,
        accessToken: manager.accessToken
      }
    };
  }, [manager, manager?.userDetails, manager?.isAuthenticated, previewMode]);

  return <UserContext value={valueMemo}>{!loading && children}</UserContext>;
};

export default withUserProvider(UserBaseContextProvider);
