import { QueryBuilderEvaluator } from '@plitzi/plitzi-ui/QueryBuilder';
import { useMemo } from 'react';

import useNavigation from '@plitzi/sdk-navigation/hooks/useNavigation';
import { processTwig } from '@plitzi/sdk-shared/helpers/twigWrapper';
import { useCommonStore, useRenderSettings } from '@plitzi/sdk-shared/store';

import AuthContext from './AuthContext';
import useAuth from './hooks/useAuth';

import type { AuthProviderSettings } from './types';
import type { AuthContextValue, Server } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type AuthContextProviderProps = {
  children?: ReactNode;
  offlineMode?: boolean;
  server: Server;
};

/** The settings whose values are authored as templates, because they differ per environment (`{{apiUrl}}/auth/login`,
 *  and the session hint cookie, whose name a backend usually suffixes per environment for the same reason). */
const TEMPLATED = [
  'loginUrl',
  'userUrl',
  'refreshUrl',
  'logoutUrl',
  'detailsPath',
  'tokenPath',
  'refreshTokenPath',
  'expirationTimePath',
  'refreshExpirationTimePath',
  'sessionHintCookie'
] as const;

const AuthContextProvider = ({ children, server }: AuthContextProviderProps) => {
  const { previewMode, isHydrating, environment } = useRenderSettings();
  const [[schemaSettings, variables]] = useCommonStore(['schema.settings', 'schema.variables']);
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

  const templated = useMemo(() => {
    const declared = Object.fromEntries(TEMPLATED.map(key => [key, schemaSettings[key]]));

    try {
      return JSON.parse(processTwig(JSON.stringify(declared), variablesParsed) as string) as Partial<
        Record<(typeof TEMPLATED)[number], string>
      >;
    } catch {
      return declared;
    }
  }, [schemaSettings, variablesParsed]);

  const settings = useMemo<AuthProviderSettings>(
    () => ({
      ...templated,
      tokenStorage: schemaSettings.tokenStorage ?? 'localStorage',
      sessionGate: schemaSettings.sessionGate,
      sessionRevalidateSeconds: schemaSettings.sessionRevalidateSeconds,
      auth0Domain: schemaSettings.auth0Domain,
      auth0ClientId: schemaSettings.auth0ClientId
    }),
    [templated, schemaSettings]
  );

  const { manager, loading, authenticated, state } = useAuth({
    server,
    isHydrating,
    provider: schemaSettings.userProvider ?? '',
    settings
  });

  const valueMemo: AuthContextValue = useMemo(
    () => ({
      login: manager.login.bind(manager),
      refresh: manager.refresh.bind(manager),
      revalidate: manager.revalidate.bind(manager),
      invalidate: manager.invalidate.bind(manager),
      can: manager.can.bind(manager),
      logout: manager.logout.bind(manager),
      state,
      authenticated: authenticated || !previewMode,
      user: manager.getProvider()
        ? { details: manager.getProvider()?.user, accessToken: manager.getProvider()?.token?.accessToken }
        : undefined
    }),
    [manager, state, authenticated, previewMode]
  );

  return <AuthContext value={valueMemo}>{!loading && children}</AuthContext>;
};

export default AuthContextProvider;
