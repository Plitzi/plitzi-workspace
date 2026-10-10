import { describe, expect, it } from 'vitest';

import { requestAuthority } from './requestParser';

/**
 * The host a request was addressed to, port included: what names this origin's cookies. HTTP/2 carries it in
 * `:authority` and sends no `Host` at all — reading only `Host` named the cookies without their port, so a visitor who
 * hid the dev tools on a server over HTTPS (HTTP/2) got them rendered back, and the page failed to hydrate.
 */
describe('requestAuthority', () => {
  it('reads the :authority of an HTTP/2 request', () => {
    expect(requestAuthority({ headers: { ':authority': 'localhost:8080' } })).toBe('localhost:8080');
  });

  it('prefers :authority to Host when both are there', () => {
    expect(requestAuthority({ headers: { ':authority': 'localhost:8080', host: 'other:1' } })).toBe('localhost:8080');
  });

  it('reads Host over HTTP/1.1', () => {
    expect(requestAuthority({ headers: { host: 'site.test:4013' } })).toBe('site.test:4013');
  });

  it('is empty when the request names no host', () => {
    expect(requestAuthority({ headers: {} })).toBe('');
  });
});
