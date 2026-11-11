/**
 * The CSRF token, from the page's side: echoed on every write a page sends with the visitor's session cookie to an API
 * that asks for one (the kernel's `createCsrf`), and renewed when it has run out.
 *
 * The page is told which APIs ask for it, the cookie it is kept in and where a new one is handed out, by the page
 * server (`<meta name="plitzi-csrf">`, from the deployment's `rsc.visitorCredentials`). A meta tag rather than state:
 * every copy of this module reads the same one — the SDK's, the builder's bundle, a plugin's. Sent to those APIs alone:
 * the token is bound to the session, and a request to anywhere else never carries it.
 */

/** The header the token is echoed in. */
export const CSRF_HEADER_NAME = 'x-csrf-token';

/** The field a `<form>` may carry it in instead. */
export const CSRF_FIELD_NAME = '_csrf';

/** The suffix of its cookie's name, after the session cookie's: `plitzi_auth` → `plitzi_auth_csrf`. */
export const CSRF_COOKIE_SUFFIX = '_csrf';

/** The meta tag the page server writes what the page needs to know in. */
export const CSRF_HINT_META = 'plitzi-csrf';

/** What a refusal for the token says, in the kernel's words: a reason a new token answers. */
export const CSRF_RENEWABLE = ['missing', 'malformed', 'expired', 'mismatch'] as const;

/** What the page is told: the APIs that ask for the token, each with the cookie it keeps it in, and where a new one is
 * handed out on each. */
export type CsrfHint = { apis: { origin: string; cookie: string }[]; path: string };

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const isApi = (value: unknown): value is CsrfHint['apis'][number] =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Record<string, unknown>).origin === 'string' &&
  typeof (value as Record<string, unknown>).cookie === 'string';

const isHint = (value: unknown): value is CsrfHint => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const { apis, path } = value as Record<string, unknown>;

  return Array.isArray(apis) && apis.every(isApi) && typeof path === 'string';
};

/** The hint the page carries, or none: a page no API asks a token of, or one drawn without a server. */
export const readCsrfHint = (doc?: Pick<Document, 'querySelector'>): CsrfHint | undefined => {
  // On the server there is no page, and so no hint: nothing there sends the visitor's cookies.
  const page = doc ?? (typeof document === 'undefined' ? undefined : document);
  const content = page?.querySelector(`meta[name="${CSRF_HINT_META}"]`)?.getAttribute('content');
  if (!content) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(content);

    return isHint(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const cookieValue = (cookies: string, name: string): string | undefined => {
  for (const part of cookies.split(';')) {
    const index = part.indexOf('=');
    if (index !== -1 && part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }

  return undefined;
};

const originOf = (input: string | URL, base: string | undefined): string | undefined => {
  try {
    return new URL(input, base).origin;
  } catch {
    return undefined;
  }
};

/**
 * The API a request goes to, when it is one that asks for the token: a write, sent with the session cookie
 * (`credentials: 'include'`), to an origin the hint names.
 */
const askingApi = (
  hint: CsrfHint | undefined,
  input: string | URL,
  init: Pick<RequestInit, 'method' | 'credentials'>
): CsrfHint['apis'][number] | undefined => {
  if (!hint || init.credentials !== 'include' || !UNSAFE.has((init.method ?? 'GET').toUpperCase())) {
    return undefined;
  }

  const origin = originOf(input, typeof location === 'undefined' ? undefined : location.href);

  return hint.apis.find(api => api.origin === origin);
};

/** Tokens handed out by an API whose cookie this page cannot read (one kept on the API's own host). */
const handedOut = new Map<string, string>();

const renew = async (fetchImpl: typeof fetch, hint: CsrfHint, origin: string): Promise<string | undefined> => {
  const response = await fetchImpl(`${origin}${hint.path}`, { credentials: 'include' });
  if (!response.ok) {
    return undefined;
  }

  const body = (await response.json()) as { token?: unknown };
  if (typeof body.token !== 'string') {
    return undefined;
  }

  handedOut.set(origin, body.token);

  return body.token;
};

const tokenFor = (api: CsrfHint['apis'][number]): string | undefined =>
  cookieValue(typeof document === 'undefined' ? '' : document.cookie, api.cookie) ?? handedOut.get(api.origin);

const withToken = (init: RequestInit, token: string): RequestInit => {
  const headers = new Headers(init.headers);
  headers.set(CSRF_HEADER_NAME, token);

  return { ...init, headers };
};

const renewable = async (response: Response): Promise<boolean> => {
  if (response.status !== 403) {
    return false;
  }

  const body = (await response
    .clone()
    .json()
    .catch(() => undefined)) as { reason?: unknown } | undefined;

  return (CSRF_RENEWABLE as readonly unknown[]).includes(body?.reason);
};

/**
 * `fetch`, echoing the CSRF token on a write sent with the session cookie to an API that asks for one — and, refused
 * for the token (it ran out, the session changed), asking for a new one and sending the write once more. Any other
 * request is sent as it is.
 */
export const csrfFetch = async (
  input: string | URL,
  init: RequestInit = {},
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<Response> => {
  const hint = readCsrfHint();
  const api = askingApi(hint, input, init);
  if (!hint || !api) {
    return fetchImpl(input, init);
  }

  const token = tokenFor(api) ?? (await renew(fetchImpl, hint, api.origin));
  const response = await fetchImpl(input, token ? withToken(init, token) : init);
  if (!(await renewable(response))) {
    return response;
  }

  const renewed = await renew(fetchImpl, hint, api.origin);

  return renewed ? fetchImpl(input, withToken(init, renewed)) : response;
};
