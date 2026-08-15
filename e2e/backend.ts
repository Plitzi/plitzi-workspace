/** One switch: is this a CI run?
 *
 *  `PLITZI_CI=1` — or `yarn e2e:ci`, which sets it — means everything a machine with no provisioning can still
 *  do: the backend is answered in the browser, and the builder runs against that instead of a server. It is also
 *  implied by `CI`, so a pipeline needs to say nothing.
 *
 *  Unset is the full run. A real `plitzi-sdk-server` on the other end is the only thing that proves anything
 *  about it — its GraphQL contract, its authorization, what it persists — so that is the default everywhere a
 *  person is working. Specs whose subject IS the server say `onlyLiveBackend()` and skip under CI rather than
 *  passing vacuously. */

export const isCiRun = (): boolean => process.env.PLITZI_CI === '1' || !!process.env.CI;

/** What a CI run cannot reach, said once. */
export const isMockBackend = (): boolean => isCiRun();

/** Where a live backend answers. Overridable, because a test stack should not have to occupy the same ports as
 *  the one somebody is developing against. */
export const liveBackend = {
  serverUrl: process.env.PLITZI_SERVER_URL ?? 'https://server.plitzi.local',
  apiServer: process.env.PLITZI_API_SERVER ?? 'https://api.plitzi.local',
  ssrServer: process.env.PLITZI_SSR_SERVER ?? 'https://ssr.plitzi.local'
};

/** The credentials a live run needs, minted with `yarn token 1 --user admin` in plitzi-sdk-server.
 *
 *  A space token is bound to the ORIGINS it was minted for, which is why the builder's own test instance runs on
 *  an origin the platform already trusts. Anywhere else, the app loads and the first call comes back 401. */
export const liveCredentials = {
  webKey: process.env.PLITZI_WEB_KEY ?? '',
  userKey: process.env.PLITZI_USER_KEY ?? ''
};

export const hasLiveCredentials = (): boolean => !!liveCredentials.webKey && !!liveCredentials.userKey;

/** Whether the builder can run at all: mocked it needs nothing, live it needs a server and a token. Derived
 *  rather than declared, so there is no flag to remember and no way to ask for a run that cannot happen. */
export const canRunBuilder = (): boolean => isCiRun() || hasLiveCredentials();
