import { use, useMemo, useRef } from 'react';

import { useNavigation } from '@plitzi/sdk-navigation';
import { evaluateRuleGroup } from '@plitzi/sdk-shared/conditions';
import { processTwig } from '@plitzi/sdk-shared/helpers/twigWrapper';
import { NetworkContext } from '@plitzi/sdk-shared/network/react';
import { useCommonStore, useRenderSettings } from '@plitzi/sdk-shared/store';

import AuthContext from './AuthContext';
import { publishedSession } from './helpers/publishedSession';
import { resolveAuthSettings } from './helpers/resolveAuthSettings';
import { testAccountAuth } from './helpers/sessionViews';
import useAuth from './hooks/useAuth';
import useSessionQueryReset from './hooks/useSessionQueryReset';

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
  'revokeUrl',
  'detailsPath',
  'tokenPath',
  'refreshTokenPath',
  'expirationTimePath',
  'refreshExpirationTimePath',
  'sessionHintCookie',
  'sessionExchangeUrl',
  'mfaUrl'
] as const;

/** The same, whoever handed it over: compared key by key, by value — a person's details, the auth settings. */
const sameByValue = (a?: object, b?: object): boolean => {
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

      const subValue = subValues.find(subValue => evaluateRuleGroup(subValue.when, variablesWhenData));
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

  const { provider: userProvider, settings } = useMemo(() => {
    const resolved = resolveAuthSettings(
      schemaSettings.userProvider,
      {
        ...templated,
        tokenStorage: schemaSettings.tokenStorage ?? 'localStorage',
        sessionGate: schemaSettings.sessionGate,
        sessionRevalidateSeconds: schemaSettings.sessionRevalidateSeconds
      },
      server.auth
    );

    return { provider: resolved.provider, settings: { ...resolved.settings, spaceKey: webKey } };
  }, [templated, schemaSettings, webKey, server.auth]);

  /**
   * The settings, held while they say the same thing. A new object is a new auth manager, and they were rebuilt
   * whenever anything they are templated from was handed over anew — the address's query, as a sign-in started — with
   * nothing in them changed: the manager started over mid sign-in, and took the page's server answer for the session.
   */
  const settingsRef = useRef(settings);
  const stableSettings = useMemo(() => {
    if (!sameByValue(settingsRef.current, settings)) {
      settingsRef.current = settings;
    }

    return settingsRef.current;
  }, [settings]);

  const {
    manager,
    loading,
    authenticated,
    signedOutHere,
    sessionChangedHere,
    state,
    bootstrapUser,
    bootstrapToken,
    peekedUser,
    peekedToken
  } = useAuth({
    server,
    isHydrating,
    provider: userProvider,
    settings: stableSettings
  });

  /**
   * The visitor, held referentially stable while they are the same visitor.
   *
   * Who published it changes during boot — the synchronous peek answers first, the provider takes over once `init()`
   * has run — and each hands over its own object. The DATA is identical; only the identity differs. That was enough
   * to recompute the auth data source, write a new `runtime.sources.auth`, and re-render everything bound to it: a
   * second pass over the page in which nothing about the session had actually changed.
   */
  const provider = manager.getProvider();
  const { user: details, accessToken } = publishedSession({
    state,
    provider: { user: provider?.user, accessToken: provider?.token?.accessToken },
    bootstrap: { user: bootstrapUser, accessToken: bootstrapToken },
    peeked: { user: peekedUser, accessToken: peekedToken }
  });

  const userRef = useRef<AuthContextValue['user']>(undefined);
  const user = useMemo(() => {
    const next = details ? { details, accessToken } : undefined;
    const current = userRef.current;
    const same = current?.accessToken === next?.accessToken && sameByValue(current?.details, next?.details);

    if (!same) {
      userRef.current = next;
    }

    return userRef.current;
  }, [details, accessToken]);

  useSessionQueryReset(authenticated ? String(user?.details?.id ?? '') : '');

  const valueMemo: AuthContextValue = useMemo(
    () => ({
      login: manager.login.bind(manager),
      refresh: manager.refresh.bind(manager),
      revalidate: manager.revalidate.bind(manager),
      invalidate: manager.invalidate.bind(manager),
      can: manager.can.bind(manager),
      logout: manager.logout.bind(manager),
      logoutEverywhere: manager.logoutEverywhere.bind(manager),
      provider: manager.getProviderType(),
      state,
      authenticated: authenticated || !previewMode,
      signedOutHere: signedOutHere && previewMode,
      sessionChangedHere,
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
    [manager, state, authenticated, signedOutHere, sessionChangedHere, previewMode, user]
  );

  // A journey's test account, set through the dev tools' inspector: the page shows that visitor, signed in.
  const [testAccount, setTestAccount] = useCommonStore('runtime.testAccount');
  const value = useMemo(
    () => (testAccount ? testAccountAuth(valueMemo, testAccount, () => setTestAccount(undefined)) : valueMemo),
    [testAccount, setTestAccount, valueMemo]
  );

  return <AuthContext value={value}>{!loading && children}</AuthContext>;
};

export default AuthContextProvider;
