import { lookup as dnsLookup } from 'node:dns/promises';

/**
 * Where a customer-authored request may go.
 *
 * Two things reach the outside world on somebody else's say-so: the `http.request` task, whose URL is typed into
 * a flow, and the connector engine, whose `baseUrl` is typed into a manifest. Both run inside the cluster, from a
 * trusted network position, which is what turns "fetch this URL for me" into a way to read the instance's cloud
 * credentials at `169.254.169.254` or talk to Redis on `localhost`. One rule, in one place, for both of them.
 */

/** Literal forms an authored URL can hold, and the ones this refuses outright. */
export const isBlockedHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host === '::1') {
    return true;
  }

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) {
    // Unique-local IPv6 (fc00::/7) and link-local (fe80::/10).
    return /^f[cd]/.test(host) || host.startsWith('fe8') || host.startsWith('fe9') || /^fe[ab]/.test(host);
  }

  const [a = 0, b = 0] = ipv4.slice(1).map(part => Number.parseInt(part, 10));

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
};

export type HostLookup = (hostname: string) => Promise<{ address: string }[]>;

const resolveAll: HostLookup = hostname => dnsLookup(hostname, { all: true, verbatim: true });

/**
 * Checks the URL an authored document asked for, including what its hostname RESOLVES to.
 *
 * The literal check alone was never enough and said so: `http://metadata.example.com/` is a public-looking name
 * whose A record can be `169.254.169.254`, and nothing about the string gives that away. So the name is resolved
 * and every address it answers is judged — a name that resolves to a private address is refused whatever it is
 * spelled like.
 *
 * A name that does not resolve is ALLOWED through: there is nothing to judge, and the request is about to fail on
 * its own with a better error than this could give. What remains open is DNS rebinding — an attacker's own server
 * answering a public address here and a private one when the socket is opened a moment later — which is closed
 * only by resolving and connecting to the same address, and that belongs in the transport rather than here.
 */
export const assertOutboundAllowed = async (url: URL, lookup: HostLookup = resolveAll): Promise<void> => {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Request protocol "${url.protocol}" is not allowed`);
  }

  if (isBlockedHost(url.hostname)) {
    throw new Error('Request host is not allowed');
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ''));
  } catch {
    return;
  }

  if (addresses.some(({ address }) => isBlockedHost(address))) {
    throw new Error('Request host is not allowed');
  }
};
