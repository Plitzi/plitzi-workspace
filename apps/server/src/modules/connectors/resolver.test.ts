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
  list: { path: '/api/{{resource}}', itemsPath: 'data', idPath: 'documentId' },
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
  flat: Record<string, Element> = {}
): RscResolveContext => {
  const provider = element(attributes, undefined, Object.keys(flat));

  return {
    element: provider,
    flat: { provider1: provider, ...flat },
    routeParams,
    queryParams: {},
    req: {} as SSRRequest,
    spaceId: 7,
    environment: 'production',
    user: undefined
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
    req: {} as SSRRequest,
    spaceId: 7,
    environment: 'production',
    user: undefined
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

  it('passes route params through to the connector query', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body));
    const resolve = createConnectorResolver({ getConnector: () => Promise.resolve(manifest), fetchImpl });

    await resolve(
      context(
        { connector: 'cms', resource: 'articles', filters: [{ field: 'slug', operator: 'eq', value: '{{slug}}' }] },
        { slug: 'hello' }
      )
    );

    expect(fetchImpl.mock.calls[0][0] as string).toContain('filters%5Bslug%5D%5B%24eq%5D=');
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
