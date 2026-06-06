import { QueryBuilderEvaluator } from '@plitzi/plitzi-ui/QueryBuilder';
import { useMemo } from 'react';

import { createStoreHook } from '@plitzi/nexus/createStore';
import useNavigation from '@plitzi/sdk-navigation/hooks/useNavigation';
import { processTwig } from '@plitzi/sdk-shared/helpers/twigWrapper';

import AuthContext from './AuthContext';
import useAuth from './hooks/useAuth';

import type { CommonState, AuthContextValue, Environment, Server } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type AuthContextProviderProps = {
  children?: ReactNode;
  isHydrating?: boolean;
  previewMode?: boolean;
  offlineMode?: boolean;
  server: Server;
  environment?: Environment;
};

const AuthContextProvider = ({
  previewMode = true,
  isHydrating = false,
  children,
  server,
  environment = 'production'
}: AuthContextProviderProps) => {
  const { useStore } = createStoreHook<CommonState>();
  const [
    [
      {
        userProvider,
        loginUrl,
        userUrl,
        refreshUrl,
        logoutUrl,
        tokenStorage = 'localStorage',
        detailsPath = 'details',
        tokenPath = 'access_token',
        expirationTimePath = 'expire_at'
      },
      variables
    ]
  ] = useStore(['schema.settings', 'schema.variables']);
  const { queryParams, hostname } = useNavigation({ server });

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

  const authData = useMemo(() => {
    try {
      return JSON.parse(
        processTwig(
          JSON.stringify({ loginUrl, userUrl, refreshUrl, logoutUrl, detailsPath, tokenPath, expirationTimePath }),
          variablesParsed
        ) as string
      ) as {
        loginUrl?: string;
        userUrl?: string;
        refreshUrl?: string;
        logoutUrl?: string;
        detailsPath?: string;
        tokenPath?: string;
        expirationTimePath?: string;
      };
    } catch {
      return { loginUrl, userUrl, refreshUrl, logoutUrl, detailsPath, tokenPath, expirationTimePath };
    }
  }, [loginUrl, userUrl, refreshUrl, logoutUrl, detailsPath, tokenPath, expirationTimePath, variablesParsed]);

  const { manager, loading, authenticated } = useAuth({
    server,
    isHydrating,
    tokenStorage,
    provider: userProvider,
    loginUrl: authData.loginUrl,
    userUrl: authData.userUrl,
    refreshUrl: authData.refreshUrl,
    logoutUrl: authData.logoutUrl,
    detailsPath: authData.detailsPath,
    tokenPath: authData.tokenPath,
    expirationTimePath: authData.expirationTimePath
  });

  const valueMemo: AuthContextValue = useMemo(
    () => ({
      manager,
      login: manager.login.bind(manager),
      refresh: manager.refresh.bind(manager),
      can: manager.can.bind(manager),
      logout: manager.logout.bind(manager),
      authenticated: authenticated || !previewMode,
      user: manager.getProvider()
        ? {
            details: manager.getProvider()?.user,
            accessToken: manager.getProvider()?.token?.accessToken
          }
        : undefined
    }),
    [manager, authenticated, previewMode]
  );

  return <AuthContext value={valueMemo}>{!loading && children}</AuthContext>;
};

export default AuthContextProvider;
