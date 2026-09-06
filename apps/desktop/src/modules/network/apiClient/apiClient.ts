export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiResult<T> =
  { ok: true; status: number; data: T } | { ok: false; status: number; reason?: string; error?: string };

export type ApiRequest = {
  path: string;
  method?: ApiMethod;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Skipped for the sign-in flows, which have no session to present yet. */
  token?: string;
  csrfToken?: string;
  signal?: AbortSignal;
};

export type ApiClientOptions = {
  baseUrl: string;
  fetcher?: typeof fetch;
};

/** What every `/auth` flow answers with, and what a failure carries. See `apps/server` `core/auth/routes.ts`. */
export type AuthFailure = { reason?: string; error?: string };

const CSRF_HEADER = 'x-csrf-token';

const url = (baseUrl: string, path: string, query: ApiRequest['query']): string => {
  const target = new URL(path.startsWith('/') ? path : `/${path}`, baseUrl);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      target.searchParams.set(key, String(value));
    }
  }

  return target.toString();
};

/**
 * The one place this app talks to the Plitzi API.
 *
 * **It presents a bearer token, not a cookie**, and that is the difference between this and the 2023 client. A
 * desktop window has an origin of its own, so the session cookie the browser app uses would be a third-party
 * cookie here — set on one site, sent from another, and subject to whatever the platform decides about those on
 * any given release. `POST /auth/login` returns `access_token` for exactly this reason, and a request carrying
 * `Authorization: Bearer` is also exempt from CSRF, so everything after sign-in needs nothing else.
 *
 * Errors never throw. A desktop app is offline as a matter of course — a closed laptop lid, a train — and a
 * transport failure is the same kind of answer as a 500: something to show, not something to crash on. `status: 0`
 * is what "the request never reached anyone" looks like.
 */
export const createApiClient = ({ baseUrl, fetcher = fetch }: ApiClientOptions) => {
  const request = async <T>({
    path,
    method = 'GET',
    body,
    query,
    token,
    csrfToken,
    signal
  }: ApiRequest): Promise<ApiResult<T>> => {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }

    if (token) {
      headers.authorization = `Bearer ${token}`;
    }

    if (csrfToken) {
      headers[CSRF_HEADER] = csrfToken;
    }

    let response: Response;
    try {
      response = await fetcher(url(baseUrl, path, query), {
        method,
        headers,
        signal,
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch {
      return { ok: false, status: 0, reason: 'unreachable' };
    }

    if (response.status === 204) {
      return { ok: true, status: 204, data: undefined as T };
    }

    // A gateway or a proxy in front of the API answers in HTML, and reading that as JSON throws inside a `catch`
    // that was meant for the network. Whatever came back that is not JSON is reported as the status it arrived as.
    let payload: unknown;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      payload = undefined;
    }

    if (!response.ok) {
      const failure = (payload ?? {}) as AuthFailure;

      return { ok: false, status: response.status, reason: failure.reason, error: failure.error };
    }

    return { ok: true, status: response.status, data: payload as T };
  };

  return { request, baseUrl };
};

export type ApiClient = ReturnType<typeof createApiClient>;

export default createApiClient;
