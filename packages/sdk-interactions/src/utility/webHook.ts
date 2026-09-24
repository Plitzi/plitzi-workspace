import { toInteractionCallback } from '@plitzi/sdk-shared/authoring/builder';
import { invalidateAfterWrite, queryCache, requestKey } from '@plitzi/sdk-shared/queries';

import { webHookSpec } from './webHookSpec';

import type { InteractionCallback } from '@plitzi/sdk-shared';

type WebHookParams = {
  url: string;
  method: string;
  /** The fields to send — or, left as the step's default, the empty text. */
  body: Record<string, string | Blob> | string;
  authorizationToken: string;
  credentials: RequestCredentials;
  cache?: boolean | string;
  staleTime?: number | string;
  invalidateQueries?: string;
  invalidateElements?: string[];
};

type WebHookResponse = { status?: number; data?: string };

/** The methods that only read: a webhook sent with any other one may have changed what the page's requests answer. */
const READ_METHODS = new Set(['GET', 'HEAD']);

/** Neither carries a body; `fetch` refuses one on a GET or a HEAD, and a DELETE is sent without one by convention. */
const BODILESS_METHODS = new Set(['GET', 'HEAD', 'DELETE']);

/** Seconds as the editor stores them; anything unreadable is the default the step declares. */
const toMilliseconds = (seconds: unknown): number => {
  const value = Number(seconds);

  return (Number.isFinite(value) && value >= 0 ? value : Number(webHookSpec.params.staleTime.default)) * 1000;
};

const authorizationOf = (token: string): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

/**
 * The fields a write sends. A body left empty is the step's default, the empty text — and sent as JSON that was the
 * text `""`, which an endpoint reading JSON refuses with a 400: a button that looked like it did nothing. Nothing to
 * send has one reading, the empty object.
 */
const fieldsOf = (body: WebHookParams['body'] | null | undefined): Record<string, string | Blob> =>
  typeof body === 'object' && body !== null ? body : {};

const send = async (
  { url, authorizationToken, body: given, credentials }: WebHookParams,
  method: string
): Promise<WebHookResponse> => {
  const body = fieldsOf(given);
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...authorizationOf(authorizationToken)
    };
    if (Object.values(body).some(value => value instanceof Blob)) {
      headers['Content-Type'] = 'multipart/form-data';
    }

    const fetchOptions: RequestInit = { method, headers, credentials };
    if (!BODILESS_METHODS.has(method)) {
      if (headers['Content-Type'] === 'application/json') {
        fetchOptions.body = JSON.stringify(body);
      } else {
        const formData = new FormData();
        Object.entries(body).forEach(([key, value]) => {
          formData.append(key, value);
        });

        fetchOptions.body = formData;
      }
    }

    const res = await fetch(url, fetchOptions);

    let data = '';
    try {
      data = (await res.json()) as string;
    } catch {
      // A body that is not JSON — or no body — answers with an empty `data`, and the status still says what happened.
    }

    return { status: res.status, data };
  } catch (e) {
    console.error(e);

    return {};
  }
};

const webHook: InteractionCallback<WebHookParams> = toInteractionCallback<WebHookParams>(
  'webHook',
  webHookSpec,
  async params => {
    const method = (params.method || 'get').toUpperCase();

    if (READ_METHODS.has(method)) {
      if (params.cache !== true && params.cache !== 'true') {
        return { response: await send(params, method) };
      }

      const key = requestKey({
        method,
        url: params.url,
        credentials: params.credentials,
        headers: authorizationOf(params.authorizationToken)
      });
      const response = await queryCache.fetchQuery<WebHookResponse>(key, {
        meta: { url: params.url },
        fetcher: () => send(params, method),
        staleTime: toMilliseconds(params.staleTime),
        isCacheable: answer => answer.status !== undefined && answer.status < 400
      });

      return { response: response ?? {} };
    }

    const response = await send(params, method);
    if (response.status !== undefined && response.status >= 200 && response.status < 300) {
      void invalidateAfterWrite({
        mode: params.invalidateQueries,
        fallback: 'origin',
        elements: params.invalidateElements,
        url: params.url
      });
    }

    return { response };
  }
);

export default webHook;
