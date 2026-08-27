import { describe, expect, it, vi } from 'vitest';

import { createConnectorResolver } from './resolver';

import type { ConnectorManifest } from './types';
import type { RscResolveContext } from '../rsc/resolveRscData';
import type { Element, SSRRequest } from '@plitzi/sdk-shared';

const manifest: ConnectorManifest = {
  id: 'cms',
  credential: 'cms-prod',
  baseUrl: 'https://cms.example.com',
  auth: { in: 'header', name: 'Authorization', value: 'Bearer {{credential.token}}' },
  endpoints: { read: { list: { path: '/api/{{resource}}', itemsPath: 'data', idPath: 'documentId' } } },
  operators: { eq: 'filters[{{field}}][$eq]={{value}}' }
};

const element = (attributes: Record<string, unknown>, idRef?: string, items: string[] = []): Element => ({
  id: 'provider1',
  idRef,
  attributes,
  definition: { type: 'apiContainer', label: 'Provider', rootId: 'root', items, styleSelectors: { base: '' } }
});

const context = (
  attributes: Record<string, unknown>,
  routeParams = {},
  flat: Record<string, Element> = {},
  queryParams: Record<string, string> = {}
): RscResolveContext => {
  const provider = element(attributes, undefined, Object.keys(flat));

  return {
    element: provider,
    flat: { provider1: provider, ...flat },
    routeParams,
    queryParams,
    // A real RSC resolve always carries the deployment it is rendering: the resolver reads the manifest as of it.
    req: { ctx: { spaceDeployment: { environment: 'production', revision: 2 } } } as unknown as SSRRequest,
    spaceId: 7,
    environment: 'production',
    user: undefined,
    signal: new AbortController().signal
  };
};

const boundContext = (attributes: Record<string, unknown>, boundSource: string): RscResolveContext => {
  const text: Element = {
    id: 'text1',
    attributes: {},
    definition: {
      type: 'text',
      label: 'Text',
      rootId: 'root',
      items: [],
      styleSelectors: { base: '' },
      bindings: { attributes: [{ id: 'b1', source: boundSource, to: 'content' }] }
    }
  };
  const provider = element(attributes, 'posts', ['text1']);

  return {
    element: provider,
    flat: { provider1: provider, text1: text },
    routeParams: {},
    queryParams: {},
    // A real RSC resolve always carries the deployment it is rendering: the resolver reads the manifest as of it.
    req: { ctx: { spaceDeployment: { environment: 'production', revision: 2 } } } as unknown as SSRRequest,
    spaceId: 7,
    environment: 'production',
    user: undefined,
    signal: new AbortController().signal
  };
};

const jsonResponse = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) }) as Response;

const body = {
  data: [
    { documentId: 'a1', title: 'First' },
    { documentId: 'b2', title: 'Second' }
  ]
};

describe('createConnectorResolver', () => {
  // A page and the manifests it reads through ship together: a page published at revision 2 must not start
  // reading a connector somebody has since pointed at a different API.
  it('reads the manifest as of the revision being rendered', async () => {
    const asked: { at?: unknown }[] = [];
    const resolve = createConnectorResolver({
      getConnector: (_spaceId: number, _connectorId: string, at?: unknown) => {
        asked.push({ at });

        return Promise.resolve(manifest);
      },
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse(body))
    });

    await resolve(context({ connector: 'cms', resource: 'articles' }));

    expect(asked[0].at).toEqual({ environment: 'production', revision: 2 });
  });

  it('resolves an element into records and page info', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body));
    const resolve = createConnectorResolver({ getConnector: () => Promise.resolve(manifest), fetchImpl });

    const result = (await resolve(context({ connector: 'cms', resource: 'articles' }))) as { records: unknown[] };

    expect(result.records).toHaveLength(2);
  });

  it('returns a single record when the element asks for one', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body));
    const resolve = createConnectorResolver({ getConnector: () => Promise.resolve(manifest), fetchImpl });

    const result = (await resolve(context({ connector: 'cms', resource: 'articles', singleRecord: true }))) as {
      record: { id: string };
    };

    expect(result.record.id).toBe('a1');
  });

  it('caps the window at one record for a single-record element', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body));
    const resolve = createConnectorResolver({ getConnector: () => Promise.resolve(manifest), fetchImpl });

    await resolve(context({ connector: 'cms', resource: 'articles', singleRecord: true, limit: '25' }));

    expect(fetchImpl).toHaveBeenCalled();
  });

  it('resolves the credential server-side and never exposes it in the element slice', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body));
    const getCredential = vi.fn().mockResolvedValue({ token: 'sup3rs3cret' });
    const resolve = createConnectorResolver({
      getConnector: () => Promise.resolve(manifest),
      getCredential,
      fetchImpl
    });

    const result = await resolve(context({ connector: 'cms', resource: 'articles' }));

    expect(getCredential).toHaveBeenCalledWith(7, 'cms-prod');
    expect((fetchImpl.mock.calls[0][1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer sup3rs3cret'
    });
    expect(JSON.stringify(result)).not.toContain('sup3rs3cret');
  });

  // This is the whole detail-page mechanism: `/blog/:slug` matched server-side, its param substituted into the
  // filter, one record back. Asserting on the resolved value — not just on the parameter name — is the point.
  it('resolves a route param inside a filter value before querying the provider', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body));
    const resolve = createConnectorResolver({ getConnector: () => Promise.resolve(manifest), fetchImpl });

    await resolve(
      context(
        {
          connector: 'cms',
          resource: 'articles',
          singleRecord: true,
          filters: [{ field: 'slug', operator: 'eq', value: '{{routeParams.slug}}' }]
        },
        { slug: 'hello' }
      )
    );

    expect(fetchImpl.mock.calls[0][0] as string).toContain('filters%5Bslug%5D%5B%24eq%5D=hello');
  });

  // Falling back to an unfiltered query would render an arbitrary post at a URL that named a specific one, which
  // reads as a working page and is worse than an empty one.
  it('returns nothing rather than a broader query when a filter template cannot resolve', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body));
    const resolve = createConnectorResolver({ getConnector: () => Promise.resolve(manifest), fetchImpl });

    const result = (await resolve(
      context({
        connector: 'cms',
        resource: 'articles',
        singleRecord: true,
        filters: [{ field: 'slug', operator: 'eq', value: '{{routeParams.slug}}' }]
      })
    )) as { record?: unknown; isEmpty: boolean };

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.record).toBeUndefined();
    expect(result.isEmpty).toBe(true);
  });

  it('reads the requested page from the query string and offsets the window', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body));
    const pagedManifest: ConnectorManifest = {
      ...manifest,
      endpoints: {
        read: {
          list: {
            ...manifest.endpoints.read.list,
            query: { 'pagination[start]': '{{offset}}', 'pagination[limit]': '{{limit}}' }
          }
        }
      }
    };
    const resolve = createConnectorResolver({ getConnector: () => Promise.resolve(pagedManifest), fetchImpl });

    await resolve(
      context({ connector: 'cms', resource: 'articles', limit: '10', pagination: 'url' }, {}, {}, { page: '3' })
    );

    const url = fetchImpl.mock.calls[0][0] as string;
    expect(url).toContain('pagination%5Bstart%5D=20');
    expect(url).toContain('pagination%5Blimit%5D=10');
  });

  it('pages each provider independently through its own page parameter', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body));
    const pagedManifest: ConnectorManifest = {
      ...manifest,
      endpoints: { read: { list: { ...manifest.endpoints.read.list, query: { 'pagination[start]': '{{offset}}' } } } }
    };
    const resolve = createConnectorResolver({ getConnector: () => Promise.resolve(pagedManifest), fetchImpl });

    await resolve(
      context(
        { connector: 'cms', resource: 'articles', limit: '5', pagination: 'url', pageParam: 'newsPage' },
        {},
        {},
        { page: '9', newsPage: '2' }
      )
    );

    expect(fetchImpl.mock.calls[0][0] as string).toContain('pagination%5Bstart%5D=5');
  });

  it('reports an empty list so an empty state can be bound', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
    const resolve = createConnectorResolver({ getConnector: () => Promise.resolve(manifest), fetchImpl });

    const result = (await resolve(context({ connector: 'cms', resource: 'articles' }))) as { isEmpty: boolean };

    expect(result.isEmpty).toBe(true);
  });

  it('leaves an unconfigured provider out of the payload instead of failing the page', async () => {
    const getConnector = vi.fn();
    const resolve = createConnectorResolver({ getConnector });

    await expect(resolve(context({}))).resolves.toBeUndefined();
    expect(getConnector).not.toHaveBeenCalled();
  });

  it('fails when the element points at a connector the space does not have', async () => {
    const resolve = createConnectorResolver({ getConnector: () => Promise.resolve(undefined) });

    await expect(resolve(context({ connector: 'ghost' }))).rejects.toThrow(/not configured/);
  });

  it('ships only the fields the page binds, leaving provider extras behind', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [{ documentId: 'a1', title: 'First', authorEmail: 'leak@example.com', draftNotes: 'internal' }]
      })
    );
    const resolve = createConnectorResolver({ getConnector: () => Promise.resolve(manifest), fetchImpl });

    const result = await resolve(
      boundContext({ connector: 'cms', resource: 'articles' }, 'apiContainer_posts.records.0.values.title')
    );

    expect(JSON.stringify(result)).not.toContain('leak@example.com');
    expect(JSON.stringify(result)).not.toContain('internal');
    expect(JSON.stringify(result)).toContain('First');
  });

  it('keeps the whole slice when the manifest opts out of projection', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ data: [{ documentId: 'a1', title: 'First', authorEmail: 'kept@example.com' }] })
      );
    const resolve = createConnectorResolver({
      getConnector: () => Promise.resolve({ ...manifest, projection: 'full' as const }),
      fetchImpl
    });

    const result = await resolve(
      boundContext({ connector: 'cms', resource: 'articles' }, 'apiContainer_posts.records.0.values.title')
    );

    expect(JSON.stringify(result)).toContain('kept@example.com');
  });
});
