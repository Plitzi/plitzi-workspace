import type { Server } from '@plitzi/sdk-shared';

export type DesktopEnvironment = 'development' | 'staging' | 'production';

/**
 * `serverUrl` carries no `/graphql`: the API is served at the root of that host.
 *
 * The 2023 config called this `graphqlServer` and appended the path, which is where it stopped working — the
 * request reached Express, passed CORS and passed the space-token check, and then 404'd on a route that does not
 * exist. It reads as an auth problem right up until you curl it.
 */
export type DesktopServers = {
  apiServer: string;
  ssrServer: string;
  server: Pick<Server, 'apiServer' | 'ssrServer' | 'serverUrl' | 'websocketServer' | 'subscriptionServer'>;
};

/**
 * Which deployment this build talks to.
 *
 * A desktop window has no hostname to read it from — the 2023 build switched on `window.location.hostname`, which
 * in a packaged app is always the same thing and so always chose "development". It is a build-time fact instead:
 * `PLITZI_DESKTOP_ENV` at build time, defaulting to production for a packaged app and to the local stack while
 * developing, and overridable at run time by `PLITZI_DESKTOP_*_SERVER` for whoever is pointing it at a branch.
 */
const ENVIRONMENTS: Record<DesktopEnvironment, DesktopServers> = {
  production: {
    apiServer: 'https://api.plitzi.com',
    ssrServer: 'https://ssr.plitzi.com',
    server: {
      apiServer: 'https://api.plitzi.com',
      ssrServer: 'https://ssr.plitzi.com',
      serverUrl: 'https://server.plitzi.com',
      websocketServer: 'wss://server.plitzi.com',
      subscriptionServer: 'wss://server.plitzi.com/subscriptions'
    }
  },
  staging: {
    apiServer: 'https://api-stg.plitzi.com',
    ssrServer: 'https://ssr-stg.plitzi.com',
    server: {
      apiServer: 'https://api-stg.plitzi.com',
      ssrServer: 'https://ssr-stg.plitzi.com',
      serverUrl: 'https://server-stg.plitzi.com',
      websocketServer: 'wss://server-stg.plitzi.com',
      subscriptionServer: 'wss://server-stg.plitzi.com/subscriptions'
    }
  },
  development: {
    apiServer: 'https://api.plitzi.local',
    ssrServer: 'https://ssr.plitzi.local',
    server: {
      apiServer: 'https://api.plitzi.local',
      ssrServer: 'https://ssr.plitzi.local',
      serverUrl: 'https://server.plitzi.local',
      websocketServer: 'wss://server.plitzi.local',
      subscriptionServer: 'wss://server.plitzi.local/subscriptions'
    }
  }
};

const isEnvironment = (value: string): value is DesktopEnvironment => value in ENVIRONMENTS;

export const resolveEnvironment = (value: string | undefined, dev: boolean): DesktopEnvironment => {
  if (value !== undefined && isEnvironment(value)) {
    return value;
  }

  return dev ? 'development' : 'production';
};

/** The servers for an environment, with any per-run override applied on top. */
export const getEnvironmentServer = (
  environment: DesktopEnvironment,
  overrides: Partial<DesktopServers['server']> = {}
): DesktopServers => {
  const base = ENVIRONMENTS[environment];
  const server = { ...base.server, ...overrides };

  return { apiServer: server.apiServer, ssrServer: server.ssrServer, server };
};

export default getEnvironmentServer;
