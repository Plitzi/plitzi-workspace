import { isRecord } from '../helpers/isRecord';
import { processTwig, templatePaths } from '../helpers/twigWrapper';
import { TOKEN_REGEX } from '../helpers/twigWrapper/tokens/tokenPatterns';

import type { Element } from '../types';

/**
 * What the page server reads a `runtime: 'server'` provider's `query` as — one rule for the server that reads it and
 * for authoring, which refuses what it cannot read.
 *
 * - `path`: a file of the server's own or the project's data (`/data/…`), read from where it is kept.
 * - `url`: another site's address, asked with GET by the page server, with the headers the provider declares —
 *   `asVisitor` when it says `credentials: 'include'`: with the visitor's cookies, where the deployment allows it.
 * - `unresolved`: what only the browser can ask — said with why, never left to resolve to nothing.
 */
export type ServerQuery =
  | { kind: 'path'; path: string }
  | { kind: 'url'; url: URL; headers: Record<string, string>; asVisitor: boolean }
  | { kind: 'unresolved'; why: string };

/**
 * What the page server knows of a visit, as a template reads it in the browser: the space's variables resolved for
 * this host (`{{ apiUrl }}`), where the visit is (`{{ navigation.routeParams.id }}`, `navigation.origin`), and the
 * state the page starts from — the keys the space paints (`settings.paintedState`), as the visitor's cookie holds them
 * (`{{ state.workspace.id }}`).
 */
export type ServerTemplateData = {
  variables: Readonly<Record<string, unknown>>;
  routeParams: Readonly<Record<string, string | undefined>>;
  queryParams: Readonly<Record<string, string>>;
  origin: string;
  /** The keys of `runtime.state` the server knows: the ones the space paints, with `keepState` on. */
  paintedKeys: ReadonlySet<string>;
  /** Their values on this visit — what the page's `runtime.state` starts from. */
  state: Readonly<Record<string, unknown>>;
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
 * visit: bound, templated over what the browser alone holds, another method. `undefined` when it can; whether the
 * address it comes to is one it reads is decided once the template is filled in (`serverQueryOf`) — and whether it may
 * carry the visitor's cookies there (`credentials: 'include'`) by the deployment, which names the APIs and the spaces
 * that may (`rsc.visitorCredentials`).
 *
 * A template may read the space's variables and `navigation` — what the page server knows of a visit. A route or
 * query param is read as `navigation.routeParams.x`: written bare (`{{ x }}`) it cannot be told from a state or a
 * provider's name before the visit.
 */
export const serverQueryProblem = (
  element: Provider,
  variableNames: ReadonlySet<string>,
  paintedKeys: ReadonlySet<string> = new Set()
): string | undefined => {
  const { query, method } = element.attributes;
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
      ? templatePaths(value)
          .filter(path => !knownToServer(path, variableNames, paintedKeys))
          .map(path => (path.startsWith('state.') ? path.split('.').slice(0, 2).join('.') : path.split('.')[0]))
      : [];
  });
  if (unknown.length > 0) {
    return `its template reads ${[...new Set(unknown)].map(root => `\`${root}\``).join(', ')}, which the browser alone holds — the page server knows the space's variables, \`navigation\` (a route param is \`navigation.routeParams.x\`) and the state the space paints (\`settings.paintedState\`, as \`state.<key>\`)`;
  }

  // The browser follows a painted key it reads only as a token of its own: an expression over one is evaluated by the page
  // server, never by the browser, which would not ask again when the visitor picks another value.
  const followed = TEMPLATED_ATTRIBUTES.some(key => {
    const value = element.attributes[key];

    return typeof value === 'string' && statePathsOf(value).length > 0 && !onlyTokens(value);
  });
  if (followed) {
    return 'its template reads `state` inside an expression, which the browser does not follow — write each value as a token of its own (`{{ apiUrl }}/workspaces/{{ state.workspace.id }}`)';
  }

  if (typeof method === 'string' && method !== '' && method.toLowerCase() !== 'get') {
    return `it asks with ${method.toUpperCase()}, and the page server reads with GET alone`;
  }

  return undefined;
};

/** Whether every `{{ … }}` of a template is a plain token — what the browser evaluates in an authored attribute. */
const onlyTokens = (template: string): boolean =>
  (template.match(/\{\{/g) ?? []).length === (template.match(TOKEN_REGEX) ?? []).length;

/** The `state.` paths a template reads, below `state`: `workspace.id`. */
const statePathsOf = (template: string): string[] =>
  template.includes('{{')
    ? templatePaths(template)
        .filter(path => path.startsWith('state.'))
        .map(path => path.slice('state.'.length))
    : [];

const valueAt = (value: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((at, key) => (isRecord(at) ? at[key] : undefined), value);

const isEmptyValue = (value: unknown): boolean => value === undefined || value === null || value === '';

/** Whether a path a template reads is one the page server holds: a variable, `navigation`, or a painted key's state. */
const knownToServer = (path: string, variableNames: ReadonlySet<string>, paintedKeys: ReadonlySet<string>): boolean => {
  const [root, ...keys] = path.split('.');

  return (
    root === 'navigation' ||
    variableNames.has(root) ||
    (root === 'state' && keys.length > 0 && paintedKeys.has(keys[0]))
  );
};

/** What an address the template came to is: a path of the space, another site's address, or neither. */
const queryAt = (query: string, headers: Record<string, string>, asVisitor: boolean): ServerQuery => {
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

  return { kind: 'url', url, headers, asVisitor };
};

/**
 * A provider's `query` as the page server reads it on a visit — its template filled in with what the server knows of
 * it, as the browser would have filled it in; `undefined` for a provider with no query at all.
 */
export const serverQueryOf = (element: Provider, data: ServerTemplateData): ServerQuery | undefined => {
  const { query, headers, accessToken, credentials } = element.attributes;
  if (typeof query !== 'string' || query === '') {
    return undefined;
  }

  const why = serverQueryProblem(element, new Set(Object.keys(data.variables)), data.paintedKeys);
  if (why !== undefined) {
    return { kind: 'unresolved', why };
  }

  // A painted key the page does not hold yet (no workspace picked) is a token the browser keeps for later, and a
  // provider it does not ask: the page server asks nothing either, and the browser asks once the key holds a value.
  if (statePathsOf(query).some(path => isEmptyValue(valueAt(data.state, path)))) {
    return undefined;
  }

  // Spread as the browser spreads them (`useElementInternal`): the variables at the root, `navigation` and `state`
  // beside them.
  const context = {
    ...data.variables,
    navigation: { routeParams: data.routeParams, queryParams: data.queryParams, origin: data.origin },
    state: data.state
  };
  const filled = (value: string): string => {
    const result = processTwig(value, context);

    return typeof result === 'string' ? result : String(result);
  };

  const asked = headersOf(headers);
  if (typeof accessToken === 'string' && accessToken !== '') {
    asked.Authorization = `Bearer ${filled(accessToken)}`;
  }

  // A template that comes to nothing asks nothing, as a browser provider with an empty query does not.
  const address = filled(query).trim();
  if (address === '') {
    return undefined;
  }

  return queryAt(address, asked, credentials === 'include');
};
