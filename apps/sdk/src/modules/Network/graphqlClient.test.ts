import { afterEach, describe, expect, it, vi } from 'vitest';

import { onAuthFailure } from '@plitzi/sdk-shared/auth/failureChannel';

import { createGraphqlClient, GraphqlRequestError } from './graphqlClient';

const URI = 'https://server.plitzi.test/graphql';

const answer = (status: number, body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

const failureOf = async (work: Promise<unknown>): Promise<GraphqlRequestError> => {
  try {
    await work;
  } catch (e: unknown) {
    if (e instanceof GraphqlRequestError) {
      return e;
    }

    throw e;
  }

  throw new Error('The request did not fail');
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createGraphqlClient', () => {
  it('posts the document and its variables with the space key, and answers the data', async () => {
    const fetchSpy = answer(200, { data: { Space: { id: 1 } } });

    const data = await createGraphqlClient(URI, 'key').request('query Init { Space { id } }', { environment: 'dev' });

    expect(data).toEqual({ Space: { id: 1 } });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(URI);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ authorization: 'Bearer key', 'content-type': 'application/json' });
    expect(typeof init?.body === 'string' ? JSON.parse(init.body) : undefined).toEqual({
      query: 'query Init { Space { id } }',
      variables: { environment: 'dev' }
    });
  });

  it('sends no bearer without a space key', async () => {
    const fetchSpy = answer(200, { data: {} });

    await createGraphqlClient(URI, '').request('query { a }');

    expect(fetchSpy.mock.calls[0][1]?.headers).toMatchObject({ authorization: '' });
  });

  it('fails with the status of a refusal, and tells the session a 401 about it', async () => {
    answer(401, { reason: 'revoked' });
    const signals: unknown[] = [];
    const stop = onAuthFailure(signal => {
      signals.push(signal);

      return undefined;
    });

    const error = await failureOf(createGraphqlClient(URI, 'key').request('query { a }'));
    stop();

    expect(error.failure).toBe('http');
    expect(error.statusCode).toBe(401);
    expect(signals).toEqual([{ reason: 'revoked', url: URI }]);
  });

  it('keeps a refusal that is not about the session away from it', async () => {
    answer(403, { reason: 'missing' });
    const signals: unknown[] = [];
    const stop = onAuthFailure(signal => {
      signals.push(signal);

      return undefined;
    });

    const error = await failureOf(createGraphqlClient(URI, 'key').request('query { a }'));
    stop();

    expect(error.statusCode).toBe(403);
    expect(signals).toEqual([]);
  });

  it('fails with the messages of the errors a 200 carries', async () => {
    answer(200, { data: null, errors: [{ message: 'Space not published' }, { message: 'Second' }] });

    const error = await failureOf(createGraphqlClient(URI, 'key').request('query { a }'));

    expect(error.failure).toBe('graphql');
    expect(error.message).toBe('Space not published\nSecond');
  });

  it('fails as a network failure when the server is never reached', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await failureOf(createGraphqlClient(URI, 'key').request('query { a }'));

    expect(error.failure).toBe('network');
    expect(error.message).toBe('Failed to fetch');
  });
});
