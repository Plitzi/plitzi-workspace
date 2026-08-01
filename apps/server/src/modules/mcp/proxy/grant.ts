import { sign, verify } from './sign';

import type { ProxyKind, ResourceProxy } from './types';

/** The single query parameter a proxied URL carries: `<signature>.<kind>.<expiry>.<connection>.<target>`. One
 *  parameter rather than several so the URL holds no `&` — these end up inside HTML attributes and markdown
 *  links, where an unescaped ampersand is the kind of detail that silently truncates a URL. */
const PARAM = 'i';

const CODE: Record<ProxyKind, string> = { asset: 'a', data: 'd' };
const KIND: Record<string, ProxyKind | undefined> = { a: 'asset', d: 'data' };

/** What a widget was granted. The kind is signed in too, so a URL minted for an image cannot be replayed as an
 *  API call (they answer with different content types, cache rules and request headers). */
export type Grant = { kind: ProxyKind; target: string };

// A runtime URL is not the URL that was signed: an apiContainer's `query` carries {{tokens}} the SDK substitutes
// in the browser. Those grants are signed over the ORIGIN, which the substitution cannot change, so the widget
// keeps working while the grant stays scoped to the one host the agent authored.
const isTemplated = (target: string): boolean => target.includes('{{');

const originOf = (target: string): string | undefined => {
  try {
    return new URL(target).origin;
  } catch {
    return undefined;
  }
};

// Percent-encoding with the twig braces left alone: they must survive into the widget for the SDK to substitute
// them, and they are not special in a query string.
const encodeTarget = (target: string): string => encodeURIComponent(target).replace(/%7B/g, '{').replace(/%7D/g, '}');

const payloadOf = (kind: ProxyKind, expiry: number, identity: string, target: string): string =>
  `${CODE[kind]}.${expiry.toString(36)}.${identity}.${target}`;

/** Mint the URL a widget will load this target from: this server's endpoint, carrying the target, the kind it was
 *  granted for, when the grant stops working and which connection minted it — all covered by one signature. */
export const grantUrl = (target: string, proxy: ResourceProxy, kind: ProxyKind = 'asset'): string => {
  const expiry = Math.floor(Date.now() / 1000) + proxy.ttl;
  const scope = (isTemplated(target) ? originOf(target) : target) ?? target;
  const signature = sign(payloadOf(kind, expiry, proxy.identity, scope), proxy.secret);
  const payload = `${CODE[kind]}.${expiry.toString(36)}.${proxy.identity}.${encodeTarget(target)}`;

  return `${proxy.endpoint}?${PARAM}=${signature}.${payload}`;
};

/** What this endpoint was asked to fetch, or undefined when the parameter is missing, malformed, expired or not
 *  signed here — which is what keeps it from being an open proxy for anyone who finds it: it serves the URLs this
 *  server rewrote, for as long as it said, and nothing else.
 *
 *  Takes the parameter as the query parser hands it over — decoded exactly once, which is the form that was
 *  signed. Decoding it again would corrupt every target that legitimately carries a percent-escape (an API URL
 *  with a nested URL in its query) and reject it as unsigned. */
export const readGrant = (param: string | undefined, secret: string): Grant | undefined => {
  const parts = param?.split('.') ?? [];
  if (parts.length < 5) {
    return undefined;
  }

  const [signature = '', code = '', expiry = '', identity = ''] = parts;
  const kind = KIND[code];
  const target = parts.slice(4).join('.');
  const expiresAt = parseInt(expiry, 36);
  if (!kind || !Number.isFinite(expiresAt) || expiresAt * 1000 < Date.now()) {
    return undefined;
  }

  const payload = payloadOf(kind, expiresAt, identity, target);
  if (verify(payload, signature, secret)) {
    return { kind, target };
  }

  // The origin-scoped form: the target reaching us is what the widget built from a signed template.
  const origin = originOf(target);

  return origin && verify(payloadOf(kind, expiresAt, identity, origin), signature, secret)
    ? { kind, target }
    : undefined;
};

export const PROXY_PARAM = PARAM;

/** Is this URL one the widget can already reach? Absolute http(s) URLs are the ones a sandbox CSP blocks;
 *  `data:`/`blob:` carry their own bytes, and a relative URL has no origin to reach in the first place. */
export const isRemote = (url: string): boolean => /^https?:\/\//i.test(url);

export const isGranted = (url: string, proxy: ResourceProxy): boolean => url.startsWith(`${proxy.endpoint}?`);
