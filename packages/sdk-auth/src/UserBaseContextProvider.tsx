import { useAuth0 } from '@auth0/auth0-react';
import { QueryBuilderEvaluator } from '@plitzi/plitzi-ui/QueryBuilder';
import get from 'lodash/get';
import { useMemo, use } from 'react';

import useNavigation from '@plitzi/sdk-navigation/hooks/useNavigation';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import SchemaSettingsContext from '@plitzi/sdk-schema/SchemaSettingsContext';
import { processTwig } from '@plitzi/sdk-shared/helpers/twigWrapper';

import withUserProvider from './hocs/withUserProvider';
import useAuth from './hooks/useAuth';
import UserContext from './UserContext';

import type { Server } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type UserBaseContextProviderProps = {
  previewMode?: boolean;
  children?: ReactNode;
  webId?: string | number;
  server: Server;
  environment?: string;
};

const UserBaseContextProvider = ({
  previewMode = true,
  children,
  webId = 0,
  server,
  environment = 'live'
}: UserBaseContextProviderProps) => {
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
      // eslint-disable-next-line react-hooks/rules-of-hooks
      loading = get(useAuth0(), 'isLoading', false) && previewMode;
      break;

    case 'basic':
    case '':
    default:
  }

  const variablesWhenData = useMemo(
    () => ({ queryParams, hostname, environment }),
    [queryParams, hostname, environment]
  );
  const variablesParsed = useMemo(() => {
    if (!Array.isArray(variables)) {
      return {};
    }

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
        ) as string
      ) as {
        loginUrl?: string;
        refreshUrl?: string;
        detailsPath?: string;
        tokenPath?: string;
        expirationTimePath?: string;
      },
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
        login: undefined,
        logout: undefined,
        refreshDetails: undefined,
        can: undefined,
        authenticated: false,
        user: { details: {}, accessToken: '' }
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
  }, [manager, manager?.isAuthenticated, previewMode]);

  return <UserContext value={valueMemo}>{!loading && children}</UserContext>;
};

const EnhancedUserBaseContextProvider = withUserProvider(UserBaseContextProvider);

export default EnhancedUserBaseContextProvider;
