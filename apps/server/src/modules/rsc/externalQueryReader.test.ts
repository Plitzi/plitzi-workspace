import { describe, expect, it } from 'vitest';

import { serverQueryOf } from '@plitzi/sdk-shared/schema';

import { externalQueryReader } from './externalQueryReader';

import type { HostLookup } from '../../helpers/outboundGuard';
import type { Element } from '@plitzi/sdk-shared';
import type { ServerTemplateData } from '@plitzi/sdk-shared/schema';

const visit: ServerTemplateData = {
  variables: {},
  routeParams: {},
  queryParams: {},
  origin: 'https://shop.example.com'
};

/** The address a provider's query comes to, as `connectorRscData` hands it over. */
const urlOf = (attributes: Record<string, unknown>) => {
  const element: Pick<Element, 'attributes' | 'definition'> = {
    attributes,
    definition: {
      label: 'Catalog',
      type: 'apiContainer',
      rootId: 'home',
      runtime: 'server',
      styleSelectors: { base: '' }
    }
  };
  const query = serverQueryOf(element, visit);
  if (query?.kind !== 'url') {
    throw new Error(`${JSON.stringify(attributes)} is no address`);
  }

  return query;
};

/** Every name a public address: what a real lookup answers for a public API. */
const publicLookup: HostLookup = () => Promise.resolve([{ address: '93.184.215.14' }]);

type Asked = { url: string; init: RequestInit };

const answering = (body: string, status = 200) => {
  const asked: Asked[] = [];
  const base = (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    asked.push({ url: input instanceof Request ? input.url : input.toString(), init });

    return Promise.resolve(new Response(body, { status }));
  };

  return { asked, base };
};

const read = (
  attributes: Record<string, unknown>,
  base: typeof fetch,
  outbound: { lookup?: HostLookup; privateOrigins?: string[] } = { lookup: publicLookup },
  maxBytes?: number
) =>
  externalQueryReader({ base, outbound, ...(maxBytes === undefined ? {} : { maxBytes }) })(
    urlOf(attributes),
    new AbortController().signal
  );

describe('externalQueryReader', () => {
  it('asks another site with GET and the headers the provider declares, and answers as a browser request does', async () => {
    const { asked, base } = answering(JSON.stringify({ items: [{ id: 1 }] }));

    expect(
      await read({ query: 'https://api.example.com/items', headers: { 'X-Shop': 'demo' }, accessToken: 'pk' }, base)
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

  it('is the provider’s error state, with why, for an answer that is no success or no JSON', async () => {
    await expect(read({ query: 'https://api.example.com/x' }, answering('{}', 404).base)).rejects.toThrow(
      'https://api.example.com/x answered 404'
    );
    await expect(read({ query: 'https://api.example.com/x' }, answering('<html>').base)).rejects.toThrow(
      'did not answer JSON'
    );
  });

  // Fetched from inside the cluster on a document's say-so: the same door every authored request goes through.
  it('never reaches a private address, however the name is spelled, and holds the answer to its ceiling', async () => {
    const { asked, base } = answering('{}');
    const toLoopback: HostLookup = () => Promise.resolve([{ address: '127.0.0.1' }]);

    await expect(read({ query: 'https://metadata.example.com/' }, base, { lookup: toLoopback })).rejects.toThrow();
    await expect(read({ query: 'http://169.254.169.254/latest' }, base)).rejects.toThrow();
    expect(asked).toEqual([]);

    await expect(
      read(
        { query: 'https://api.example.com/big' },
        answering(JSON.stringify({ blob: 'x'.repeat(200) })).base,
        { lookup: publicLookup },
        100
      )
    ).rejects.toThrow('byte budget');
  });

  // A local S3, a cluster's own API: named by whoever runs the server, and reached — that origin alone.
  it('reaches an origin the deployment names as its own on its network', async () => {
    const { asked, base } = answering(JSON.stringify({ ok: true }));

    expect(
      await read({ query: 'http://localhost:9000/seeds/catalogue.json' }, base, {
        privateOrigins: ['http://localhost:9000']
      })
    ).toEqual({ status: 200, data: { ok: true } });
    await expect(
      read({ query: 'http://localhost:6379/' }, base, { privateOrigins: ['http://localhost:9000'] })
    ).rejects.toThrow('not allowed');
    expect(asked).toHaveLength(1);
  });
});
