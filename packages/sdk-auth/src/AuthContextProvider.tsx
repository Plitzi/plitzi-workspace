import { QueryBuilderEvaluator } from '@plitzi/plitzi-ui/QueryBuilder';
import { use, useMemo, useRef } from 'react';

import useNavigation from '@plitzi/sdk-navigation/hooks/useNavigation';
import { processTwig } from '@plitzi/sdk-shared/helpers/twigWrapper';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
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
  'sessionHintCookie',
  'sessionExchangeUrl'
] as const;

/** Same person, whoever handed them over: the fields a page binds to, compared by value. */
const sameDetails = (a?: object, b?: object): boolean => {
  if (a === b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);

  return [...keys].every(key => JSON.stringify(left[key]) === JSON.stringify(right[key]));
};

const AuthContextProvider = ({ children, server }: AuthContextProviderProps) => {
  const { previewMode, isHydrating, environment } = useRenderSettings();
  // Which space this is. Only the exchange sends it, and only a space can say which identity provider it trusts.
  const { webKey } = use(NetworkContext);
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

  const settings = useMemo<AuthProviderSettings & { spaceKey: string }>(
    () => ({
      ...templated,
      spaceKey: webKey,
      tokenStorage: schemaSettings.tokenStorage ?? 'localStorage',
      sessionGate: schemaSettings.sessionGate,
      sessionRevalidateSeconds: schemaSettings.sessionRevalidateSeconds
    }),
    [templated, schemaSettings, webKey]
  );

  const { manager, loading, authenticated, state, bootstrapUser, bootstrapToken, peekedUser, peekedToken } = useAuth({
    server,
    isHydrating,
    provider: schemaSettings.userProvider ?? '',
    settings
  });

  /**
   * The visitor, held referentially stable while they are the same visitor.
   *
   * Who published it changes during boot — the synchronous peek answers first, the provider takes over once `init()`
   * has run — and each hands over its own object. The DATA is identical; only the identity differs. That was enough
   * to recompute the auth data source, write a new `runtime.sources.auth`, and re-render everything bound to it: a
   * second pass over the page in which nothing about the session had actually changed.
   */
  const providerUser = manager.getProvider()?.user;
  const details = providerUser ?? bootstrapUser ?? peekedUser;
  const accessToken = providerUser
    ? manager.getProvider()?.token?.accessToken
    : bootstrapUser
      ? bootstrapToken
      : peekedToken;

  const userRef = useRef<AuthContextValue['user']>(undefined);
  const user = useMemo(() => {
    const next = details ? { details, accessToken } : undefined;
    const current = userRef.current;
    const same = current?.accessToken === next?.accessToken && sameDetails(current?.details, next?.details);

    if (!same) {
      userRef.current = next;
    }

    return userRef.current;
  }, [details, accessToken]);

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
      /**
       * The provider's session once it has one, and until then the best thing already known about this visitor.
       *
       * The provider is filled in by `init()`, which is an effect — so it holds nothing for the first commit, and
       * reading it alone published an EMPTY auth data source. On a server-rendered page that meant every
       * `{{user.*}}` binding rendered blank in the HTML and filled in after hydration; on a client-rendered one it
       * meant the same blank first paint on every reload, with the session sitting in storage the whole time.
       * `bootstrapUser` covers the first case, `peekedUser` the second.
       */
      user
    }),
    [manager, state, authenticated, previewMode, user]
  );

  return <AuthContext value={valueMemo}>{!loading && children}</AuthContext>;
};

export default AuthContextProvider;
