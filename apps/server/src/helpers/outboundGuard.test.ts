import { describe, expect, it, vi } from 'vitest';

import { assertOutboundAllowed, fetchOutbound, isBlockedHost } from './outboundGuard';

const resolvesTo = (address: string) => () => Promise.resolve([{ address }]);
const unresolvable = () => Promise.reject(new Error('ENOTFOUND'));

/** Every name resolves to a public address, so only what the test names as private is ever refused. */
const publicLookup = resolvesTo('93.184.216.34');

const redirectTo = (location: string, status = 302) => new Response(null, { status, headers: { Location: location } });

describe('isBlockedHost', () => {
  it('refuses the literal addresses that reach the cluster from inside it', () => {
    for (const host of ['localhost', '127.0.0.1', '169.254.169.254', '10.0.0.1', '192.168.1.1', 'db.internal']) {
      expect(isBlockedHost(host), `${host} was allowed`).toBe(true);
    }
  });

  it('allows an ordinary public address', () => {
    for (const host of ['example.com', '93.184.216.34', '8.8.8.8', '[2606:4700:4700::1111]']) {
      expect(isBlockedHost(host), `${host} was refused`).toBe(false);
    }
  });

  /**
   * The same private IPv4 addresses, spelled as IPv6.
   *
   * WHATWG URL parsing turns `[::ffff:127.0.0.1]` into `[::ffff:7f00:1]`, which no IPv4 pattern matches, and a
   * dual-stack socket connects it to loopback all the same. `::` is the unspecified address, which Linux connects to
   * the local host.
   */
  it('refuses private IPv4 addresses written as IPv6', () => {
    for (const raw of [
      'http://[::ffff:127.0.0.1]:6379/',
      'http://[::ffff:169.254.169.254]/',
      'http://[::ffff:10.0.0.1]/',
      'http://[::]/',
      'http://[::127.0.0.1]/',
      'http://[64:ff9b::a9fe:a9fe]/',
      'http://[64:ff9b::10.0.0.1]/',
      'http://[2002:7f00:1::]/',
      'http://[2002:c0a8:101::1]/'
    ]) {
      const { hostname } = new URL(raw);
      expect(isBlockedHost(hostname), `${raw} (${hostname}) was allowed`).toBe(true);
    }
  });

  /**
   * An IPv6-only cluster reaches every IPv4 API through NAT64 — DNS64 answers `api.example.com` with `64:ff9b::` and the
   * public address inside it. Refusing the prefix whole would refuse every one of them.
   */
  it('allows a public IPv4 address carried by NAT64 or 6to4', () => {
    for (const host of ['64:ff9b::5db8:d822', '64:ff9b::93.184.216.34', '2002:5db8:d822::1']) {
      expect(isBlockedHost(host), `${host} was refused`).toBe(false);
    }
  });

  it('refuses the IPv6 ranges that are never a public peer', () => {
    for (const host of ['::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1']) {
      expect(isBlockedHost(host), `${host} was allowed`).toBe(true);
    }
  });

  it('refuses the IPv4 ranges that are never a public peer', () => {
    for (const host of [
      '0.0.0.0',
      '100.64.0.1',
      '172.16.0.1',
      '192.0.0.1',
      '198.18.0.1',
      '224.0.0.1',
      '255.255.255.255'
    ]) {
      expect(isBlockedHost(host), `${host} was allowed`).toBe(true);
    }
  });

  /** A NAME is judged by what it resolves to, never by how it is spelled — `fcbarcelona.com` is not `fc00::/7`. */
  it('does not mistake a name that starts like an IPv6 prefix for an address', () => {
    for (const host of ['fcbarcelona.com', 'fe80-docs.example.com', 'fdic.gov']) {
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

  /** The AAAA-record form of the same thing: a name whose IPv6 answer is a private IPv4 address in disguise. */
  it('refuses a name that resolves to a private IPv4 address mapped into IPv6', async () => {
    await expect(
      assertOutboundAllowed(new URL('https://api.example.com/'), resolvesTo('::ffff:127.0.0.1'))
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

describe('fetchOutbound', () => {
  it('refuses a private destination without sending anything', async () => {
    const base = vi.fn<typeof fetch>();

    await expect(fetchOutbound(base, new URL('http://[::ffff:127.0.0.1]/'), {}, publicLookup)).rejects.toThrow(
      /not allowed/
    );
    expect(base).not.toHaveBeenCalled();
  });

  /**
   * The check has to hold for every hop, not just the URL the document named.
   *
   * A public URL whose server answers `302 Location: http://169.254.169.254/` was followed by `fetch` on its own, so
   * the only URL ever judged was the harmless first one.
   */
  it('refuses a redirect to a private destination', async () => {
    const base = vi.fn<typeof fetch>().mockResolvedValueOnce(redirectTo('http://169.254.169.254/latest/meta-data/'));

    await expect(fetchOutbound(base, new URL('https://api.example.com/'), {}, publicLookup)).rejects.toThrow(
      /not allowed/
    );
    expect(base).toHaveBeenCalledTimes(1);
    expect(base.mock.calls[0]?.[1]?.redirect).toBe('manual');
  });

  it('follows a redirect to a public destination', async () => {
    const base = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(redirectTo('/v2/items', 301))
      .mockResolvedValueOnce(new Response('ok'));

    const response = await fetchOutbound(base, new URL('https://api.example.com/v1/items'), {}, publicLookup);

    expect(await response.text()).toBe('ok');
    expect(base.mock.calls[1]?.[0]).toBe('https://api.example.com/v2/items');
  });

  it('gives up after too many redirects', async () => {
    const base = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(redirectTo('https://api.example.com/')));

    await expect(fetchOutbound(base, new URL('https://api.example.com/'), {}, publicLookup)).rejects.toThrow(
      /redirects/
    );
  });

  /** What a browser's fetch does too: 303 always, and 301/302 after a POST, continue as a bodiless GET. */
  it('turns a POST into a GET where the redirect says to', async () => {
    const base = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(redirectTo('https://api.example.com/done', 303))
      .mockResolvedValueOnce(new Response('ok'));

    await fetchOutbound(
      base,
      new URL('https://api.example.com/submit'),
      { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } },
      publicLookup
    );

    const followed = base.mock.calls[1]?.[1];
    expect(followed?.method).toBe('GET');
    expect(followed?.body).toBeUndefined();
    expect(new Headers(followed?.headers).has('content-type')).toBe(false);
  });

  it('keeps the method and body across a 307', async () => {
    const base = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(redirectTo('https://api.example.com/moved', 307))
      .mockResolvedValueOnce(new Response('ok'));

    await fetchOutbound(base, new URL('https://api.example.com/submit'), { method: 'PUT', body: '{}' }, publicLookup);

    expect(base.mock.calls[1]?.[1]?.method).toBe('PUT');
    expect(base.mock.calls[1]?.[1]?.body).toBe('{}');
  });

  /** A credential the customer configured for one provider must not be handed to whatever host it redirects to. */
  it('drops the credentials when a redirect leaves the origin', async () => {
    const base = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(redirectTo('https://elsewhere.example.net/'))
      .mockResolvedValueOnce(new Response('ok'));

    await fetchOutbound(
      base,
      new URL('https://api.example.com/'),
      { headers: { Authorization: 'Bearer secret', Cookie: 'a=b', 'X-Trace': '1' } },
      publicLookup
    );

    const headers = new Headers(base.mock.calls[1]?.[1]?.headers);
    expect(headers.has('authorization')).toBe(false);
    expect(headers.has('cookie')).toBe(false);
    expect(headers.get('x-trace')).toBe('1');
  });
});
