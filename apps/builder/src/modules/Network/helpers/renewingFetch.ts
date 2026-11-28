import { authFailureFromResponse } from '@plitzi/sdk-shared/auth';

import { renewedCredential } from './renewedCredential';

import type { Credential } from './credential';

/** The header the builder's requests carry the person's credential in (`App`'s link, the uploads, the deploys). */
export const CREDENTIAL_HEADER = 'plitzi-access-token';

type WithHeaders = { headers?: HeadersInit };

const urlOf = (input: URL | RequestInfo): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

const bodyOf = async (response: Response): Promise<unknown> => {
  try {
    return await response.clone().json();
  } catch {
    return undefined;
  }
};

/**
 * Its headers as a plain record — what both the `fetch` and the uploads' `XMLHttpRequest` read — with the credential
 * replaced.
 */
const withCredential = <Init extends WithHeaders>(init: Init | undefined, credential: string): Init => {
  const headers = new Headers(init?.headers);
  headers.set(CREDENTIAL_HEADER, credential);

  // `Init` is the wrapped fetch's own options, whose `headers` is any `HeadersInit`: a record is one.
  return { ...init, headers: Object.fromEntries(headers.entries()) } as Init;
};

/**
 * A request of the builder's whose credential was refused, asked again once the session renewed because of it.
 *
 * A tab left in the background past its token's life — a laptop that slept, a renewal timer the browser froze — comes
 * back and asks everything again at once with the token it had: each refused, and each refusal was a toast saying
 * "Authentication required" over a session that a renewal answered a moment later. The refusal is said to auth with
 * the credential it carried (`renewedCredential`) — the GraphQL server's 401 too, which carries its errors rather than
 * a reason — and when auth renewed because of it, the request waits for the page to hand the builder its new
 * credential and is asked again, once. A refusal that ends the session is answered as it was.
 */
export const renewingFetch =
  <Init extends WithHeaders>(
    fetchImpl: (input: URL | RequestInfo, init?: Init) => Promise<Response>,
    credential: Credential
  ) =>
  async (input: URL | RequestInfo, init?: Init): Promise<Response> => {
    const sent = new Headers(init?.headers).get(CREDENTIAL_HEADER) ?? credential.current;
    const response = await fetchImpl(input, init);
    if (response.status !== 401) {
      return response;
    }

    const reason = authFailureFromResponse(response.status, await bodyOf(response));
    const renewed = reason && (await renewedCredential(credential, sent, { reason, url: urlOf(input) }));
    if (!renewed) {
      return response;
    }

    return fetchImpl(input, withCredential(init, renewed));
  };
