/** Which backend the suite runs against.
 *
 *  **live** — a real `plitzi-sdk-server`. The default anywhere but CI, and the only mode that proves anything
 *  about the server: its GraphQL contract, its authorization, what it persists. A suite that always mocks is a
 *  suite that has stopped testing half the product.
 *
 *  **mock** — the browser answers those calls itself. The default in CI, where there is no sibling repository,
 *  no databases and no certificates. It keeps the UI covered where the server cannot be reached, and it is a
 *  narrower claim on purpose: what a mocked run proves is that the app renders and reacts, not that the server
 *  agrees.
 *
 *  Force either one with `PLITZI_E2E_BACKEND=live|mock`. Specs that only mean something against a real server
 *  say so with {@link onlyLiveBackend} and skip under a mock rather than passing vacuously. */

export type BackendMode = 'live' | 'mock';

const fromEnv = (): BackendMode | undefined => {
  const value = process.env.PLITZI_E2E_BACKEND;

  return value === 'live' || value === 'mock' ? value : undefined;
};

export const backendMode = (): BackendMode => fromEnv() ?? (process.env.CI ? 'mock' : 'live');

export const isMockBackend = (): boolean => backendMode() === 'mock';

/** Where a live backend is expected to answer. Overridable, because a test stack should not have to occupy the
 *  same ports as the one somebody is developing against. */
export const liveBackend = {
  serverUrl: process.env.PLITZI_E2E_SERVER_URL ?? 'https://server.plitzi.local',
  apiServer: process.env.PLITZI_E2E_API_SERVER ?? 'https://api.plitzi.local',
  ssrServer: process.env.PLITZI_E2E_SSR_SERVER ?? 'https://ssr.plitzi.local'
};

/** The credentials a live run needs. Minted with `yarn token 1 --user admin` in plitzi-sdk-server.
 *
 *  A space token is bound to the ORIGINS it was minted for, so a builder served from anywhere other than the
 *  usual `app.plitzi.local:3000` needs that origin in `PLATFORM_ORIGINS` before the token will be accepted —
 *  otherwise the app loads and the first call comes back 401. */
export const liveCredentials = {
  webKey: process.env.PLITZI_E2E_WEB_KEY ?? '',
  userKey: process.env.PLITZI_E2E_USER_KEY ?? ''
};

export const hasLiveCredentials = (): boolean => !!liveCredentials.webKey && !!liveCredentials.userKey;
