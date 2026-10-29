import { describe, expect, it } from 'vitest';

import { externalQueryResolver } from './externalQueryResolver';

import type { RscResolveContext } from './resolveRscData';
import type { Element } from '@plitzi/sdk-shared';

const provider = (attributes: Record<string, unknown>): Element => ({
  id: 'catalog',
  attributes,
  definition: {
    label: 'Catalog',
    type: 'apiContainer',
    rootId: 'home',
    runtime: 'server',
    styleSelectors: { base: '' }
  }
});

/** Every name a public address: what a real lookup answers for a public API. */
const publicLookup = () => Promise.resolve([{ address: '93.184.215.14' }]);

type Asked = { url: string; init: RequestInit };

const answering = (body: string, status = 200) => {
  const asked: Asked[] = [];
  const base = (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    asked.push({ url: input instanceof Request ? input.url : input.toString(), init });

    return Promise.resolve(new Response(body, { status }));
  };

  return { asked, base };
};

// The resolver reads the element and the signal; the rest of a context is the request it never looks at.
const resolve = (attributes: Record<string, unknown>, base: typeof fetch, lookup = publicLookup, maxBytes?: number) =>
  externalQueryResolver({ base, lookup, ...(maxBytes === undefined ? {} : { maxBytes }) })({
    element: provider(attributes),
    signal: new AbortController().signal
  } as RscResolveContext);

describe('externalQueryResolver', () => {
  it('asks another site with GET and the headers the provider declares, and answers as a browser request does', async () => {
    const { asked, base } = answering(JSON.stringify({ items: [{ id: 1 }] }));

    expect(
      await resolve({ query: 'https://api.example.com/items', headers: { 'X-Shop': 'demo' }, accessToken: 'pk' }, base)
    ).toEqual({ status: 200, data: { items: [{ id: 1 }] } });
    expect(asked).toHaveLength(1);
    expect(asked[0]?.url).toBe('https://api.example.com/items');
    expect(asked[0]?.init.method).toBe('GET');
    expect(asked[0]?.init.credentials).toBe('omit');
    expect(asked[0]?.init.headers).toEqual({
      Accept: 'application/json',
      'X-Shop': 'demo',
      Authorization: 'Bearer pk'
    });
  });

  it('leaves alone what is not another site’s address: a path, a provider with no query', async () => {
    const { asked, base } = answering('{}');

    expect(await resolve({ query: '/data/menu.json' }, base)).toBeUndefined();
    expect(await resolve({ action: 'list-posts' }, base)).toBeUndefined();
    expect(asked).toEqual([]);
  });

  it('is the provider’s error state, with why, for an answer that is no success or no JSON', async () => {
    await expect(resolve({ query: 'https://api.example.com/x' }, answering('{}', 404).base)).rejects.toThrow(
      'https://api.example.com/x answered 404'
    );
    await expect(resolve({ query: 'https://api.example.com/x' }, answering('<html>').base)).rejects.toThrow(
      'did not answer JSON'
    );
  });

  // Fetched from inside the cluster on a document's say-so: the same door every authored request goes through.
  it('never reaches a private address, however the name is spelled, and holds the answer to its ceiling', async () => {
    const { asked, base } = answering('{}');
    const toLoopback = () => Promise.resolve([{ address: '127.0.0.1' }]);

    await expect(resolve({ query: 'https://metadata.example.com/' }, base, toLoopback)).rejects.toThrow();
    await expect(resolve({ query: 'http://169.254.169.254/latest' }, base)).rejects.toThrow();
    expect(asked).toEqual([]);

    await expect(
      resolve(
        { query: 'https://api.example.com/big' },
        answering(JSON.stringify({ blob: 'x'.repeat(200) })).base,
        publicLookup,
        100
      )
    ).rejects.toThrow('byte budget');
  });
});
