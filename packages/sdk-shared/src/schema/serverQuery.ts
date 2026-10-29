import type { Element } from '../types';

/**
 * What the page server reads a `runtime: 'server'` provider's `query` as — one rule for the server that reads it and
 * for authoring, which refuses what it cannot read.
 *
 * - `path`: a file of the server's own or the project's data (`/data/…`), read from where it is kept.
 * - `url`: another site's address, asked with GET by the page server, with the headers the provider declares.
 * - `unresolved`: what only the browser can ask — a templated or bound address, a token bound to the visitor, the
 *   visitor's cookies, another method — said with why, never left to resolve to nothing.
 */
export type ServerQuery =
  | { kind: 'path'; path: string }
  | { kind: 'url'; url: URL; headers: Record<string, string> }
  | { kind: 'unresolved'; why: string };

/** The attributes a request is made of: bound, each is a value the browser alone resolves. */
const REQUEST_ATTRIBUTES: readonly string[] = ['query', 'headers', 'accessToken', 'method', 'credentials'];

const headersOf = (headers: unknown): Record<string, string> =>
  typeof headers === 'object' && headers !== null
    ? Object.fromEntries(
        Object.entries(headers).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      )
    : {};

/** A provider's `query` as the page server reads it; `undefined` for a provider with no query at all. */
export const serverQueryOf = (element: Pick<Element, 'attributes' | 'definition'>): ServerQuery | undefined => {
  const { query, method, headers, accessToken, credentials } = element.attributes;
  if (typeof query !== 'string' || query === '') {
    return undefined;
  }

  const bound = (element.definition.bindings?.attributes ?? [])
    .filter(binding => binding.enabled !== false && REQUEST_ATTRIBUTES.includes(binding.to))
    .map(binding => binding.to);
  if (bound.length > 0) {
    return {
      kind: 'unresolved',
      why: `its ${[...new Set(bound)].join(', ')} is bound, which the browser alone resolves`
    };
  }

  if (query.includes('{{') || (typeof accessToken === 'string' && accessToken.includes('{{'))) {
    return { kind: 'unresolved', why: 'it is written with a template, which the browser alone fills in' };
  }

  if (typeof method === 'string' && method !== '' && method.toLowerCase() !== 'get') {
    return {
      kind: 'unresolved',
      why: `it asks with ${method.toUpperCase()}, and the page server reads with GET alone`
    };
  }

  // The page server never sends the visitor's cookies: asked there, the visitor's own data would answer as a stranger's.
  if (credentials === 'include') {
    return {
      kind: 'unresolved',
      why: "it asks with the visitor's cookies (`credentials: 'include'`), which the page server never sends"
    };
  }

  if (query.startsWith('//')) {
    return { kind: 'unresolved', why: `"${query}" names no protocol — write https:` };
  }

  if (query.startsWith('/')) {
    return { kind: 'path', path: query };
  }

  let url: URL;
  try {
    url = new URL(query);
  } catch {
    return { kind: 'unresolved', why: `"${query}" is neither an address (https://…) nor a path of the space (/…)` };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return {
      kind: 'unresolved',
      why: `"${query}" is read with ${url.protocol}, and the page server reads http(s) alone`
    };
  }

  const asked = headersOf(headers);
  if (typeof accessToken === 'string' && accessToken !== '') {
    asked.Authorization = `Bearer ${accessToken}`;
  }

  return { kind: 'url', url, headers: asked };
};
