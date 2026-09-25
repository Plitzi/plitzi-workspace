import { lookup as dnsLookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

/**
 * Where a customer-authored request may go.
 *
 * Two things reach the outside world on somebody else's say-so: the `http.request` task, whose URL is typed into
 * a flow, and the connector engine, whose `baseUrl` is typed into a manifest. Both run inside the cluster, from a
 * trusted network position, which is what turns "fetch this URL for me" into a way to read the instance's cloud
 * credentials at `169.254.169.254` or talk to Redis on `localhost`. One rule, in one place, for both of them.
 */

/**
 * Every range that is never a public peer, as ranges rather than string patterns.
 *
 * A `BlockList` also judges an IPv4-mapped IPv6 address (`::ffff:7f00:1`) against the IPv4 rules, which is the form a
 * URL parser turns `[::ffff:127.0.0.1]` into and a dual-stack socket happily connects to loopback. The prefix
 * patterns this replaced matched neither that nor `::`, and matched DNS names that merely began with `fc` or `fe8`.
 */
const privateRanges = new BlockList();

const IPV4_RANGES: [string, number][] = [
  ['0.0.0.0', 8], // "this network" — connects to the local host
  ['10.0.0.0', 8],
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8],
  ['169.254.0.0', 16], // link-local, the cloud metadata service
  ['172.16.0.0', 12],
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.168.0.0', 16],
  ['198.18.0.0', 15], // benchmarking
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4] // reserved, and the broadcast address
];

const IPV6_RANGES: [string, number][] = [
  ['::', 96], // unspecified, loopback and the deprecated IPv4-compatible form
  ['64:ff9b::', 96], // NAT64: an IPv4 address the gateway reaches for us
  ['64:ff9b:1::', 48], // local-use NAT64
  ['2002::', 16], // 6to4: an IPv4 address carried in the prefix
  ['fc00::', 7], // unique-local
  ['fe80::', 10], // link-local
  ['ff00::', 8] // multicast
];

IPV4_RANGES.forEach(([network, prefix]) => privateRanges.addSubnet(network, prefix, 'ipv4'));
IPV6_RANGES.forEach(([network, prefix]) => privateRanges.addSubnet(network, prefix, 'ipv6'));

const isBlockedName = (host: string): boolean =>
  host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal');

/**
 * Whether a hostname — or an address a name resolved to — may never be the other end of an authored request.
 *
 * A NAME is only refused for what it says it is (`localhost`, `*.internal`); anything else about a name is decided by
 * what it resolves to, in `assertOutboundAllowed`.
 */
export const isBlockedHost = (hostname: string): boolean => {
  // Brackets are how a URL carries an IPv6 host; a zone id (`fe80::1%eth0`) is what a resolver may answer with.
  const host = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/%.*$/, '');
  const family = isIP(host);
  if (family === 0) {
    return isBlockedName(host);
  }

  return privateRanges.check(host, family === 6 ? 'ipv6' : 'ipv4');
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

const MAX_REDIRECTS = 5;

const REDIRECT_STATUSES = [301, 302, 303, 307, 308];

/** What the Fetch standard strips when a redirect leaves the origin that was given them. */
const CROSS_ORIGIN_HEADERS = ['authorization', 'cookie', 'proxy-authorization'];

const BODY_HEADERS = ['content-type', 'content-length', 'content-encoding', 'content-language', 'content-location'];

/**
 * The request a redirect continues as — the rules `fetch` itself follows, applied by hand because it no longer does.
 *
 * A 303, and a 301/302 answering a POST, become a bodiless GET; 307 and 308 repeat the request exactly. Leaving the
 * origin drops the credentials, so a provider that redirects elsewhere cannot hand the customer's key to that host.
 */
const redirectedInit = (init: RequestInit, status: number, crossOrigin: boolean): RequestInit => {
  const method = (init.method ?? 'GET').toUpperCase();
  const becomesGet = (status === 303 && method !== 'HEAD') || ((status === 301 || status === 302) && method === 'POST');
  const headers = new Headers(init.headers);

  if (crossOrigin) {
    CROSS_ORIGIN_HEADERS.forEach(name => headers.delete(name));
  }

  if (!becomesGet) {
    return { ...init, headers };
  }

  BODY_HEADERS.forEach(name => headers.delete(name));

  return { ...init, method: 'GET', body: undefined, headers };
};

/**
 * Sends an authored request, judging EVERY hop it takes by `assertOutboundAllowed`.
 *
 * Checking the URL and handing it to `fetch` judged only the first hop: `fetch` follows redirects on its own, so a
 * public server answering `302 Location: http://169.254.169.254/` took the request wherever it liked. Redirects are
 * therefore taken manually and each destination is checked before anything is sent to it.
 *
 * `base` is the caller's own transport — the action runner's is budgeted and capped — so every hop is also counted
 * against whatever that transport enforces.
 */
export const fetchOutbound = async (
  base: typeof fetch,
  url: URL,
  init: RequestInit = {},
  lookup: HostLookup = resolveAll
): Promise<Response> => {
  let target = url;
  let request = init;

  for (let hop = 0; ; hop += 1) {
    await assertOutboundAllowed(target, lookup);

    const response = await base(target.toString(), { ...request, redirect: 'manual' });
    const location = response.headers.get('location');
    if (!REDIRECT_STATUSES.includes(response.status) || !location) {
      return response;
    }

    await response.body?.cancel();

    if (hop >= MAX_REDIRECTS) {
      throw new Error(`Request followed more than ${MAX_REDIRECTS} redirects`);
    }

    const next = new URL(location, target);
    request = redirectedInit(request, response.status, next.origin !== target.origin);
    target = next;
  }
};
