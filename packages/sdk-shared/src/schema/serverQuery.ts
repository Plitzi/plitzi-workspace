import { processTwig, templateRootNames } from '../helpers/twigWrapper';

import type { Element } from '../types';

/**
 * What the page server reads a `runtime: 'server'` provider's `query` as — one rule for the server that reads it and
 * for authoring, which refuses what it cannot read.
 *
 * - `path`: a file of the server's own or the project's data (`/data/…`), read from where it is kept.
 * - `url`: another site's address, asked with GET by the page server, with the headers the provider declares.
 * - `unresolved`: what only the browser can ask — said with why, never left to resolve to nothing.
 */
export type ServerQuery =
  | { kind: 'path'; path: string }
  | { kind: 'url'; url: URL; headers: Record<string, string> }
  | { kind: 'unresolved'; why: string };

/**
 * What the page server knows of a visit, as a template reads it in the browser: the space's variables resolved for
 * this host (`{{ apiUrl }}`), and where the visit is (`{{ navigation.routeParams.id }}`, `navigation.origin`).
 */
export type ServerTemplateData = {
  variables: Readonly<Record<string, unknown>>;
  routeParams: Readonly<Record<string, string | undefined>>;
  queryParams: Readonly<Record<string, string>>;
  origin: string;
};

type Provider = Pick<Element, 'attributes' | 'definition'>;

/** The attributes a request is made of: bound, each is a value the browser alone resolves. */
const REQUEST_ATTRIBUTES: readonly string[] = ['query', 'headers', 'accessToken', 'method', 'credentials'];

/** The attributes a template may be written in, evaluated as the browser evaluates an authored text attribute. */
const TEMPLATED_ATTRIBUTES = ['query', 'accessToken'] as const;

const headersOf = (headers: unknown): Record<string, string> =>
  typeof headers === 'object' && headers !== null
    ? Object.fromEntries(
        Object.entries(headers).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      )
    : {};

/**
 * Why the page server cannot ask a provider's `query` — from what is written alone, so authoring says it before a
 * visit: bound, templated over what the browser alone holds, the visitor's cookies, another method. `undefined` when it
 * can; whether the address it comes to is one it reads is decided once the template is filled in (`serverQueryOf`).
 *
 * A template may read the space's variables and `navigation` — what the page server knows of a visit. A route or
 * query param is read as `navigation.routeParams.x`: written bare (`{{ x }}`) it cannot be told from a state or a
 * provider's name before the visit.
 */
export const serverQueryProblem = (element: Provider, variableNames: ReadonlySet<string>): string | undefined => {
  const { query, method, credentials } = element.attributes;
  if (typeof query !== 'string' || query === '') {
    return undefined;
  }

  const bound = (element.definition.bindings?.attributes ?? [])
    .filter(binding => binding.enabled !== false && REQUEST_ATTRIBUTES.includes(binding.to))
    .map(binding => binding.to);
  if (bound.length > 0) {
    return `its ${[...new Set(bound)].join(', ')} is bound, which the browser alone resolves`;
  }

  const unknown = TEMPLATED_ATTRIBUTES.flatMap(key => {
    const value = element.attributes[key];

    return typeof value === 'string' && value.includes('{{')
      ? templateRootNames(value).filter(root => root !== 'navigation' && !variableNames.has(root))
      : [];
  });
  if (unknown.length > 0) {
    return `its template reads ${[...new Set(unknown)].map(root => `\`${root}\``).join(', ')}, which the browser alone holds — the page server knows the space's variables and \`navigation\` (a route param is \`navigation.routeParams.x\`)`;
  }

  if (typeof method === 'string' && method !== '' && method.toLowerCase() !== 'get') {
    return `it asks with ${method.toUpperCase()}, and the page server reads with GET alone`;
  }

  // The page server never sends the visitor's cookies: asked there, the visitor's own data would answer as a stranger's.
  if (credentials === 'include') {
    return "it asks with the visitor's cookies (`credentials: 'include'`), which the page server never sends";
  }

  return undefined;
};

/** What an address the template came to is: a path of the space, another site's address, or neither. */
const queryAt = (query: string, headers: Record<string, string>): ServerQuery => {
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

  return { kind: 'url', url, headers };
};

/**
 * A provider's `query` as the page server reads it on a visit — its template filled in with what the server knows of
 * it, as the browser would have filled it in; `undefined` for a provider with no query at all.
 */
export const serverQueryOf = (element: Provider, data: ServerTemplateData): ServerQuery | undefined => {
  const { query, headers, accessToken } = element.attributes;
  if (typeof query !== 'string' || query === '') {
    return undefined;
  }

  const why = serverQueryProblem(element, new Set(Object.keys(data.variables)));
  if (why !== undefined) {
    return { kind: 'unresolved', why };
  }

  // Spread as the browser spreads them (`useElementInternal`): the variables at the root, `navigation` beside them.
  const context = {
    ...data.variables,
    navigation: { routeParams: data.routeParams, queryParams: data.queryParams, origin: data.origin }
  };
  const filled = (value: string): string => {
    const result = processTwig(value, context);

    return typeof result === 'string' ? result : String(result);
  };

  const asked = headersOf(headers);
  if (typeof accessToken === 'string' && accessToken !== '') {
    asked.Authorization = `Bearer ${filled(accessToken)}`;
  }

  return queryAt(filled(query), asked);
};
