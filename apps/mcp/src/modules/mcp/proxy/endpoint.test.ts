import { beforeEach, describe, expect, it, vi } from 'vitest';

import { grantUrl, readGrant } from './grant';
import { handleProxyRequest } from './handler';

import type { ResourceProxy, ResourceProxySettings } from './types';
import type { SSRRequest, SSRResponseHelpers } from '@plitzi/sdk-shared';

// The SSRF guard is exercised in proxy.test.ts against real addresses; here every host is public, so these tests
// are about what the endpoint does with what it fetched.
vi.mock('./guard', () => ({ isPublicHost: () => Promise.resolve(true), isPrivateAddress: () => false }));

const proxy: ResourceProxy = {
  endpoint: 'https://mcp.example.com/__proxy',
  secret: 'test-secret',
  identity: 'conn1',
  ttl: 3600,
  tools: ['plitzi_render']
};

const settings: ResourceProxySettings = {
  path: '/__proxy',
  secret: proxy.secret,
  maxBytes: 1024,
  ttl: proxy.ttl,
  tools: proxy.tools
};

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const requestFor = (url: string, method = 'GET'): SSRRequest => ({
  method,
  path: '/__proxy',
  search: '',
  url,
  hostname: 'mcp.example.com',
  protocol: 'https',
  // The endpoint mints grants of its own while serving an API answer, and it addresses itself by the origin the
  // request arrived on.
  headers: { host: 'mcp.example.com' },
  query: Object.fromEntries(new URL(url).searchParams.entries()),
  ctx: {}
});

type Recorded = { status: number; headers: Record<string, string | string[]>; body: Buffer };

const recorder = (): { res: SSRResponseHelpers; out: Recorded } => {
  const out: Recorded = { status: 200, headers: {}, body: Buffer.alloc(0) };
  const res: SSRResponseHelpers = {
    get status() {
      return out.status;
    },
    get headers() {
      return out.headers;
    },
    setHeader: (name, value) => {
      out.headers[name] = value;
    },
    setStatus: code => {
      out.status = code;
    },
    send: body => {
      out.body = Buffer.from(body);
    },
    write: chunk => {
      out.body = Buffer.concat([out.body, Buffer.from(chunk)]);
    },
    end: () => undefined
  };

  return { res, out };
};

const upstream = (response: Response | Response[]): void => {
  const queue = Array.isArray(response) ? [...response] : [response];
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(queue.length > 1 ? (queue.shift() as Response) : queue[0]))
  );
};

describe('the widget resource endpoint', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('serves an asset it granted itself', async () => {
    upstream(new Response(PNG, { status: 200, headers: { 'content-type': 'image/png', 'content-length': '8' } }));
    const { res, out } = recorder();

    await handleProxyRequest(requestFor(grantUrl('https://cdn.example.com/a.png', proxy)), res, settings);

    expect(out.status).toBe(200);
    expect(out.headers['Content-Type']).toBe('image/png');
    // The host's iframe is on another origin, and a widget should ask for each asset once.
    expect(out.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(out.headers['Cache-Control']).toContain('max-age');
    expect(Buffer.compare(out.body, Buffer.from(PNG))).toBe(0);
  });

  // An API answer is fetched because it changes; caching it would leave the widget on yesterday's data.
  it('serves data uncached', async () => {
    upstream(new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }));
    const { res, out } = recorder();

    await handleProxyRequest(requestFor(grantUrl('https://api.example.com/items', proxy, 'data')), res, settings);

    expect(out.status).toBe(200);
    expect(out.headers['Cache-Control']).toBe('no-store');
    expect(out.body.toString()).toBe('{"ok":true}');
  });

  // An upstream content-length measures the ENCODED body (gzip, almost always, for an API). Forwarding it cut the
  // response at the compressed size and the widget got half a JSON document — found by fetching a real API
  // through a real endpoint, so it is pinned here.
  it('does not forward a length that describes the encoded body', async () => {
    const json = JSON.stringify({ items: Array.from({ length: 40 }, (_, index) => ({ index })) });
    upstream(
      new Response(json, {
        status: 200,
        // What a gzip'd response declares: far less than the bytes fetch hands over decoded.
        headers: { 'content-type': 'application/json', 'content-length': '120' }
      })
    );
    const { res, out } = recorder();

    await handleProxyRequest(requestFor(grantUrl('https://api.example.com/items', proxy, 'data')), res, settings);

    expect(out.status).toBe(200);
    expect(out.headers['Content-Length']).toBeUndefined();
    expect(out.body.toString()).toBe(json);
    expect(() => {
      JSON.parse(out.body.toString());
    }).not.toThrow();
  });

  // The URLs a data-driven widget actually paints come from the API, not from the render — and they would be
  // loaded straight from the API's CDN, which the host CSP does not declare.
  it('grants the asset URLs an API answer carries', async () => {
    const meals = JSON.stringify({
      meals: [
        {
          name: 'Shakshuka',
          strMealThumb: 'https://cdn.example.com/1.jpg',
          source: 'https://recipes.example.com/shakshuka'
        }
      ]
    });
    upstream(new Response(meals, { status: 200, headers: { 'content-type': 'application/json' } }));
    const { res, out } = recorder();

    await handleProxyRequest(requestFor(grantUrl('https://api.example.com/meals', proxy, 'data')), res, settings);

    const served = JSON.parse(out.body.toString()) as { meals: { strMealThumb: string; source: string }[] };
    expect(served.meals[0]?.strMealThumb).toContain(`${proxy.endpoint}?i=`);
    expect(
      readGrant(new URL(served.meals[0]?.strMealThumb ?? '').searchParams.get('i') ?? '', settings.secret)
    ).toEqual({ kind: 'asset', target: 'https://cdn.example.com/1.jpg', identity: proxy.identity });
    // A link is a destination, not something the widget loads: proxying it would hand the browser bytes where it
    // expected a page.
    expect(served.meals[0]?.source).toBe('https://recipes.example.com/shakshuka');
  });

  it('serves a body that is not the JSON it claimed as it came', async () => {
    upstream(new Response('not json at all', { status: 200, headers: { 'content-type': 'application/json' } }));
    const { res, out } = recorder();

    await handleProxyRequest(requestFor(grantUrl('https://api.example.com/items', proxy, 'data')), res, settings);

    expect(out.status).toBe(200);
    expect(out.body.toString()).toBe('not json at all');
  });

  it('refuses a URL it did not grant', async () => {
    upstream(new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } }));
    const { res, out } = recorder();

    await handleProxyRequest(
      requestFor('https://mcp.example.com/__proxy?i=fake.a.zzz.c.https%3A%2F%2Fevil'),
      res,
      settings
    );

    expect(out.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers anything but a read with 405, and preflights', async () => {
    const post = recorder();
    await handleProxyRequest(requestFor(grantUrl('https://cdn.example.com/a.png', proxy), 'POST'), post.res, settings);
    expect(post.out.status).toBe(405);

    const options = recorder();
    await handleProxyRequest(
      requestFor(grantUrl('https://cdn.example.com/a.png', proxy), 'OPTIONS'),
      options.res,
      settings
    );
    expect(options.out.status).toBe(204);
  });

  // The whole point of the hop: a sandbox that cannot follow a cross-origin redirect gets the final bytes anyway.
  it('follows redirects for the widget', async () => {
    upstream([
      new Response(null, { status: 302, headers: { location: 'https://other.example.com/real.png' } }),
      new Response(PNG, { status: 200, headers: { 'content-type': 'image/jpeg' } })
    ]);
    const { res, out } = recorder();

    await handleProxyRequest(requestFor(grantUrl('https://cdn.example.com/a.png', proxy)), res, settings);

    expect(out.status).toBe(200);
    expect(out.headers['Content-Type']).toBe('image/jpeg');
  });

  // A URL that answers with a page instead of a picture is the common authoring mistake; passing it through would
  // make the endpoint a general-purpose proxy for HTML.
  it('refuses a response of the wrong kind', async () => {
    upstream(new Response('<html>not an image</html>', { status: 200, headers: { 'content-type': 'text/html' } }));
    const { res, out } = recorder();

    await handleProxyRequest(requestFor(grantUrl('https://cdn.example.com/a.png', proxy)), res, settings);

    expect(out.status).toBe(415);
  });

  it('refuses a response larger than the deployment allows', async () => {
    upstream(
      new Response(PNG, { status: 200, headers: { 'content-type': 'image/png', 'content-length': '99999999' } })
    );
    const { res, out } = recorder();

    await handleProxyRequest(requestFor(grantUrl('https://cdn.example.com/big.png', proxy)), res, settings);

    expect(out.status).toBe(413);
  });

  it('reports an upstream failure rather than an empty 200', async () => {
    upstream(new Response('nope', { status: 404 }));
    const { res, out } = recorder();

    await handleProxyRequest(requestFor(grantUrl('https://cdn.example.com/gone.png', proxy)), res, settings);

    expect(out.status).toBe(502);
  });
});
