import { describe, expect, it } from 'vitest';

import { buildServerInfo } from './buildServerInfo';

import type { SSRRequest, SSRServerConfig, ServerSSR } from '@plitzi/sdk-shared';

/** A request as `parseRequest` makes one: a host it cannot trust leaves `hostname` empty. */
const request = (host: string, protocol: 'http' | 'https' = 'http'): SSRRequest => ({
  method: 'GET',
  path: '/agents',
  search: '',
  url: '/agents',
  hostname: /^[a-zA-Z0-9.-]+$/.test(host.split(':')[0]) ? host.split(':')[0] : '',
  protocol,
  headers: { host },
  query: {},
  ctx: {}
});

const config = { environment: 'production' } as SSRServerConfig;
const ssr = {} as ServerSSR;

describe('buildServerInfo', () => {
  it('names the page’s origin with its port, as the browser’s own location does', () => {
    const { location, origin } = buildServerInfo(request('127.0.0.1:4016'), config, ssr);

    expect(origin).toBe('http://127.0.0.1:4016');
    expect(location?.origin).toBe('http://127.0.0.1:4016');
    expect(location?.host).toBe('127.0.0.1:4016');
    expect(location?.hostname).toBe('127.0.0.1');
  });

  it('has no port to name on the default one', () => {
    expect(buildServerInfo(request('pizarra.example', 'https'), config, ssr).location?.origin).toBe(
      'https://pizarra.example'
    );
  });

  it('keeps a forged host out of it', () => {
    expect(buildServerInfo(request('evil.example"><script>'), config, ssr).location?.origin).toBe('http://');
  });
});

/**
 * What the page is told about signing in. A project served by `createServer({ auth })` declared nothing in its space
 * and got a sign-in form that did nothing: the server served `/auth` and never said so.
 */
describe('buildServerInfo — the sign-in it serves', () => {
  const pageAuth = {
    userProvider: 'basic',
    loginUrl: '/auth/login',
    userUrl: '/auth/session',
    logoutUrl: '/auth/logout'
  };

  it('hands the page the endpoints, and the hint cookie named for the host it was asked on', () => {
    const withAuth = {
      ...config,
      pageAuth,
      authCookie: { name: (hostname: string) => (hostname === 'acme.test' ? 'acme_session' : 'other_session') }
    } as SSRServerConfig;

    expect(buildServerInfo(request('acme.test'), withAuth, ssr).auth).toEqual({
      ...pageAuth,
      sessionHintCookie: 'acme_session_hint'
    });
    expect(buildServerInfo(request('other.test'), withAuth, ssr).auth?.sessionHintCookie).toBe('other_session_hint');
  });

  it('says nothing when it serves no sign-in of its own', () => {
    expect(buildServerInfo(request('acme.test'), config, ssr).auth).toBeUndefined();
  });
});
