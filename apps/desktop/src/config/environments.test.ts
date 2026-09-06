import { describe, expect, it } from 'vitest';

import { getEnvironmentServer, resolveEnvironment } from './environments';

describe('the desktop environment', () => {
  it('takes the one it was built for', () => {
    expect(resolveEnvironment('staging', false)).toBe('staging');
  });

  /**
   * The old build read `window.location.hostname`, which in a packaged app is a constant — so every installed
   * copy pointed at localhost. A value that is not an environment must therefore fall back to what the build IS,
   * never to development, or one typo ships an app that talks to a server the user does not run.
   */
  it('falls back to production for a packaged build, whatever it was handed', () => {
    expect(resolveEnvironment(undefined, false)).toBe('production');
    expect(resolveEnvironment('local-branch', false)).toBe('production');
  });

  it('falls back to the local stack while developing', () => {
    expect(resolveEnvironment(undefined, true)).toBe('development');
  });

  it('answers a whole set of servers for an environment', () => {
    const { apiServer, server } = getEnvironmentServer('production');

    expect(apiServer).toBe('https://api.plitzi.com');
    expect(server.subscriptionServer).toBe('wss://server.plitzi.com/subscriptions');
  });

  it('lets one server be pointed elsewhere without restating the rest', () => {
    const { apiServer, server } = getEnvironmentServer('development', { apiServer: 'https://api.branch.test' });

    expect(apiServer).toBe('https://api.branch.test');
    expect(server.ssrServer).toBe('https://ssr.plitzi.local');
  });
});
