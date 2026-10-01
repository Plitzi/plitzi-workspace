import { authFailureFromResponse, reportAuthFailure } from '@plitzi/sdk-shared/auth/failureChannel';

/** Where a request stopped: never reached the server, refused by it, or answered with errors in place of data. */
export type GraphqlFailure = 'network' | 'http' | 'graphql';

export class GraphqlRequestError extends Error {
  readonly failure: GraphqlFailure;
  readonly statusCode?: number;

  constructor(message: string, failure: GraphqlFailure, statusCode?: number) {
    super(message);
    this.name = 'GraphqlRequestError';
    this.failure = failure;
    this.statusCode = statusCode;
  }
}

export type GraphqlClient = {
  request: <T>(document: string, variables?: Record<string, unknown>) => Promise<T>;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const parseBody = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const errorMessages = (body: unknown): string[] => {
  const errors = isRecord(body) ? body.errors : undefined;
  if (!Array.isArray(errors)) {
    return [];
  }

  return errors.map(error => (isRecord(error) && typeof error.message === 'string' ? error.message : 'Unknown error'));
};

/**
 * What the SDK sends its server: a handful of queries, always to the network, never cached, never subscribed to. A
 * GraphQL client with a normalized cache would be most of the SDK's weight for that, so this is a `fetch`.
 *
 * A refusal still counts for the session: it goes to the auth-failure channel, the way the builder's Apollo link sends
 * it, so a session revoked elsewhere is noticed by whichever request is refused next.
 */
export const createGraphqlClient = (uri: string, webKey: string): GraphqlClient => ({
  request: async <T>(document: string, variables?: Record<string, unknown>): Promise<T> => {
    let response: Response;
    try {
      response = await fetch(uri, {
        method: 'POST',
        headers: {
          accept: 'application/graphql-response+json, application/json;q=0.9',
          'content-type': 'application/json',
          'sdk-version': VERSION,
          authorization: webKey ? `Bearer ${webKey}` : ''
        },
        body: JSON.stringify({ query: document, variables })
      });
    } catch (e: unknown) {
      throw new GraphqlRequestError(e instanceof Error ? e.message : 'Network request failed', 'network');
    }

    const body = parseBody(await response.text());
    if (!response.ok) {
      const reason = authFailureFromResponse(response.status, body);
      if (reason) {
        void reportAuthFailure({ reason, url: uri });
      }

      throw new GraphqlRequestError(
        `Response not successful: Received status code ${response.status}`,
        'http',
        response.status
      );
    }

    const messages = errorMessages(body);
    if (messages.length) {
      throw new GraphqlRequestError(messages.join('\n'), 'graphql', response.status);
    }

    if (!isRecord(body) || !isRecord(body.data)) {
      throw new GraphqlRequestError('The server answered without data', 'graphql', response.status);
    }

    // The shape a query's result has is the schema's promise, not something this client can check.
    return body.data as T;
  }
});
