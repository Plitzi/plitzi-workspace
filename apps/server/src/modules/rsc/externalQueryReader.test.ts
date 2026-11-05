import { describe, expect, it, vi } from 'vitest';

import { serverQueryOf } from '@plitzi/sdk-shared/schema';

import { externalQueryReader, visitorCredentialsOf } from './externalQueryReader';

import type { SSRVisitorCredentialsConfig } from '../../types';
import type { HostLookup } from '@plitzi/sdk-kernel/outbound';
import type { SSRRequest } from '@plitzi/sdk-kernel/types';
import type { Element } from '@plitzi/sdk-shared';
import type { ServerTemplateData } from '@plitzi/sdk-shared/schema';

const visit: ServerTemplateData = {
  variables: {},
  routeParams: {},
  queryParams: {},
  origin: 'https://shop.example.com',
  paintedKeys: new Set(['workspace']),
  state: { workspace: { id: 5 } }
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

/** A visit to the page, with the cookies its browser sent. */
const visitWith = (cookie?: string): SSRRequest => ({
  method: 'GET',
  path: '/spaces/3',
  search: '',
  url: '/spaces/3',
  hostname: 'app.example.com',
  protocol: 'https',
  headers: cookie ? { cookie } : {},
  query: {},
  ctx: {}
});

const read = (
  attributes: Record<string, unknown>,
  base: typeof fetch,
  outbound: { lookup?: HostLookup; privateOrigins?: string[] } = { lookup: publicLookup },
  maxBytes?: number
) =>
  externalQueryReader({ base, outbound, ...(maxBytes === undefined ? {} : { maxBytes }) })(
    urlOf(attributes),
    new AbortController().signal,
    { req: visitWith('session=s1'), spaceId: 1, environment: 'production' }
  );

/** Asked as the visitor, on a server that allows it as `config` says. */
const readAsVisitor = (
  query: string,
  config: SSRVisitorCredentialsConfig,
  { cookie = 'session=s1; theme=dark', spaceId = 1 }: { cookie?: string; spaceId?: number } = {}
) => {
  const { asked, base } = answering(JSON.stringify({ me: 'ana' }));
  const req = visitWith(cookie);
  const answer = externalQueryReader({
    base,
    outbound: { lookup: publicLookup },
    visitor: visitorCredentialsOf(config)
  })(urlOf({ query, credentials: 'include' }), new AbortController().signal, {
    req,
    spaceId,
    environment: 'production'
  });

  return { answer, asked, req };
};

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

  // Never the cookies of a visit that asked for a stranger's answer: `credentials: 'include'` alone carries them.
  it('carries no cookie of the visitor for a provider that did not ask with them', async () => {
    const { asked, base } = answering('{}');
    await read({ query: 'https://api.example.com/me' }, base);

    expect(asked[0]?.init.headers).not.toHaveProperty('Cookie');
  });
});

describe('externalQueryReader / as the visitor', () => {
  const api: SSRVisitorCredentialsConfig = { origins: ['https://api.example.com'] };

  it('carries the visitor’s cookies to an API the deployment names, and marks the page read so', async () => {
    const { answer, asked, req } = readAsVisitor('https://api.example.com/me', api);

    expect(await answer).toEqual({ status: 200, data: { me: 'ana' } });
    expect(asked[0]?.init.headers).toMatchObject({ Cookie: 'session=s1; theme=dark' });
    expect(req.ctx.readAsVisitor).toBe(true);
  });

  // Where the server reaches it (`via`) is a hop over its own network: `createServer.visitorCredentials.test.ts`.
  it('carries only the cookies it names', async () => {
    const { answer, asked } = readAsVisitor('https://api.example.com/spaces/3', { ...api, cookies: ['session'] });

    await answer;
    expect(asked[0]?.init.headers).toMatchObject({ Cookie: 'session=s1' });
  });

  // Asked as a stranger, the visitor's own data would answer as somebody else's: refused, saying what to change.
  it('refuses an API the deployment does not name, a space it does not trust, and a server that allows neither', async () => {
    const elsewhere = readAsVisitor('https://evil.example.com/me', api);
    await expect(elsewhere.answer).rejects.toThrow('rsc.visitorCredentials.origins');
    expect(elsewhere.asked).toEqual([]);

    const untrusted = readAsVisitor(
      'https://api.example.com/me',
      { ...api, spaces: ({ spaceId }) => spaceId === 1 },
      { spaceId: 2 }
    );
    await expect(untrusted.answer).rejects.toThrow('rsc.visitorCredentials.spaces');
    expect(untrusted.req.ctx.readAsVisitor).toBeUndefined();

    const { asked, base } = answering('{}');
    await expect(
      externalQueryReader({ base, outbound: { lookup: publicLookup } })(
        urlOf({ query: 'https://api.example.com/me', credentials: 'include' }),
        new AbortController().signal,
        { req: visitWith('session=s1'), spaceId: 1, environment: 'production' }
      )
    ).rejects.toThrow('rsc.visitorCredentials.origins');
    expect(asked).toEqual([]);
  });

  it('drops the cookies on a redirect away from the API', async () => {
    const asked: Asked[] = [];
    const base = (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
      asked.push({ url: input instanceof Request ? input.url : input.toString(), init });

      return Promise.resolve(
        asked.length === 1
          ? new Response(null, { status: 302, headers: { location: 'https://elsewhere.example.com/' } })
          : new Response('{}')
      );
    };
    await externalQueryReader({ base, outbound: { lookup: publicLookup }, visitor: visitorCredentialsOf(api) })(
      urlOf({ query: 'https://api.example.com/me', credentials: 'include' }),
      new AbortController().signal,
      { req: visitWith('session=s1'), spaceId: 1, environment: 'production' }
    );

    expect(new Headers(asked[0]?.init.headers).get('cookie')).toBe('session=s1');
    expect(new Headers(asked[1]?.init.headers).get('cookie')).toBeNull();
  });

  it('is refused when the server is built, for what is not an origin or a way to one it does not name', () => {
    expect(() => visitorCredentialsOf({ origins: ['https://api.example.com/v1'] })).toThrow('no path');
    expect(() =>
      visitorCredentialsOf({ origins: ['https://api.example.com'], via: { 'https://other.example.com': 'http://x:1' } })
    ).toThrow('not one of its origins');
  });
});

/** A site that answers only when told to, and counts what it was asked and what was given up. */
const holding = () => {
  const asked: Asked[] = [];
  const releases: (() => void)[] = [];
  const base = (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    asked.push({ url: input instanceof Request ? input.url : input.toString(), init });

    return new Promise<Response>((resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('given up')), { once: true });
      releases.push(() => resolve(new Response(JSON.stringify({ n: asked.length }))));
    });
  };

  return { asked, base, release: () => releases.splice(0).forEach(release => release()) };
};

// Two parts of one page asking the same address (the plan, the account) is one request to it, not two.
describe('externalQueryReader / one render', () => {
  const asker = (req: SSRRequest) => ({ req, spaceId: 1, environment: 'production' as const });

  it('reads an address its providers all ask once, and hands each the answer', async () => {
    const { asked, base, release } = holding();
    const reader = externalQueryReader({ base, outbound: { lookup: publicLookup } });
    const req = visitWith('session=s1');
    const query = urlOf({ query: 'https://api.example.com/plan' });

    const first = reader(query, new AbortController().signal, asker(req));
    const second = reader(query, new AbortController().signal, asker(req));
    await vi.waitFor(() => {
      expect(asked).toHaveLength(1);
    });
    release();

    expect(await first).toEqual({ status: 200, data: { n: 1 } });
    expect(await second).toEqual({ status: 200, data: { n: 1 } });
    expect(await reader(query, new AbortController().signal, asker(req))).toEqual({ status: 200, data: { n: 1 } });
    expect(asked).toHaveLength(1);
  });

  it('reads it again for another visit, another address or other headers', async () => {
    const { asked, base } = answering('{}');
    const reader = externalQueryReader({ base, outbound: { lookup: publicLookup } });
    const req = visitWith('session=s1');

    await reader(urlOf({ query: 'https://api.example.com/a' }), new AbortController().signal, asker(req));
    await reader(urlOf({ query: 'https://api.example.com/a' }), new AbortController().signal, asker(visitWith()));
    await reader(urlOf({ query: 'https://api.example.com/b' }), new AbortController().signal, asker(req));
    await reader(
      urlOf({ query: 'https://api.example.com/a', headers: { 'X-Shop': 'demo' } }),
      new AbortController().signal,
      asker(req)
    );

    expect(asked.map(({ url }) => url)).toEqual([
      'https://api.example.com/a',
      'https://api.example.com/a',
      'https://api.example.com/b',
      'https://api.example.com/a'
    ]);
  });

  it('keeps the read for a provider still waiting when another gives up, and stops it once none waits', async () => {
    const { asked, base, release } = holding();
    const reader = externalQueryReader({ base, outbound: { lookup: publicLookup } });
    const req = visitWith('session=s1');
    const query = urlOf({ query: 'https://api.example.com/plan' });

    const quitting = new AbortController();
    const quitter = reader(query, quitting.signal, asker(req));
    const stayer = reader(query, new AbortController().signal, asker(req));
    await vi.waitFor(() => {
      expect(asked).toHaveLength(1);
    });
    quitting.abort(new Error('timed out'));
    release();

    await expect(quitter).rejects.toThrow('timed out');
    expect(await stayer).toEqual({ status: 200, data: { n: 1 } });

    const alone = new AbortController();
    const abandoned = reader(urlOf({ query: 'https://api.example.com/other' }), alone.signal, asker(req));
    await vi.waitFor(() => {
      expect(asked).toHaveLength(2);
    });
    alone.abort(new Error('timed out'));

    await expect(abandoned).rejects.toThrow('timed out');
    expect(asked[1]?.init.signal?.aborted).toBe(true);

    // Asked again after everyone gave up on it: read again, not handed the stopped one.
    const again = reader(urlOf({ query: 'https://api.example.com/other' }), new AbortController().signal, asker(req));
    await vi.waitFor(() => {
      expect(asked).toHaveLength(3);
    });
    release();

    expect(await again).toEqual({ status: 200, data: { n: 3 } });
  });
});
