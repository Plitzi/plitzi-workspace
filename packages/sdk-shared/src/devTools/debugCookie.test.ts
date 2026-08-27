import { describe, it, expect } from 'vitest';

import { debugCookieName } from './debugCookie';

/**
 * The whole point of the helper is the port, and the reason is a property of cookies rather than of this code:
 * their scope is the host, so two sites on one host share the jar.
 */
describe('the dev-tools preference cookie', () => {
  it('keeps localhost ports apart, so one example cannot hide another example panel', () => {
    expect(debugCookieName('127.0.0.1:4013')).not.toBe(debugCookieName('127.0.0.1:5009'));
  });

  it('names it for the port whenever there is one', () => {
    expect(debugCookieName('localhost:3000')).toBe('plitzi_debug_3000');
  });

  it('leaves a deployment on a default port with the plain name', () => {
    expect(debugCookieName('example.com')).toBe('plitzi_debug');
  });

  // The server reads `req.headers.host`, which is absent on a request that did not carry one.
  it('answers something usable with no host at all', () => {
    expect(debugCookieName(undefined)).toBe('plitzi_debug');
  });
});
