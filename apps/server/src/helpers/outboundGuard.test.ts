import { describe, expect, it } from 'vitest';

import { assertOutboundAllowed, isBlockedHost } from './outboundGuard';

const resolvesTo = (address: string) => () => Promise.resolve([{ address }]);
const unresolvable = () => Promise.reject(new Error('ENOTFOUND'));

describe('isBlockedHost', () => {
  it('refuses the literal addresses that reach the cluster from inside it', () => {
    for (const host of ['localhost', '127.0.0.1', '169.254.169.254', '10.0.0.1', '192.168.1.1', 'db.internal']) {
      expect(isBlockedHost(host), `${host} was allowed`).toBe(true);
    }
  });

  it('allows an ordinary public address', () => {
    for (const host of ['example.com', '93.184.216.34', '8.8.8.8']) {
      expect(isBlockedHost(host), `${host} was refused`).toBe(false);
    }
  });
});

describe('assertOutboundAllowed', () => {
  it('refuses a protocol that is not http', async () => {
    await expect(assertOutboundAllowed(new URL('file:///etc/passwd'), resolvesTo('1.1.1.1'))).rejects.toThrow(
      /protocol/
    );
  });

  it('refuses a literal private address', async () => {
    await expect(assertOutboundAllowed(new URL('http://169.254.169.254/'), resolvesTo('1.1.1.1'))).rejects.toThrow(
      /not allowed/
    );
  });

  /**
   * The one the literal check could never catch, and the reason this resolves at all.
   *
   * `metadata.example.com` is a public-looking name that nothing about the string gives away — and its A record
   * is the cloud metadata service. The document that named it was written by a customer.
   */
  it('refuses a public-looking name that resolves somewhere private', async () => {
    await expect(
      assertOutboundAllowed(new URL('https://metadata.example.com/latest/'), resolvesTo('169.254.169.254'))
    ).rejects.toThrow(/not allowed/);
  });

  it('allows a name that resolves somewhere public', async () => {
    await expect(
      assertOutboundAllowed(new URL('https://api.example.com/'), resolvesTo('93.184.216.34'))
    ).resolves.toBeUndefined();
  });

  /** Nothing to judge, and the request is about to fail on its own with a better error than this could give. */
  it('allows a name that does not resolve', async () => {
    await expect(assertOutboundAllowed(new URL('https://nowhere.invalid/'), unresolvable)).resolves.toBeUndefined();
  });
});
