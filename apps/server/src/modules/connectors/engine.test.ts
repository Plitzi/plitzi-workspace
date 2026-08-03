import { describe, expect, it, vi } from 'vitest';

import { fetchConnectorRecords, rebaseMedia } from './engine';

import type { ConnectorManifest } from './types';

const strapi: ConnectorManifest = {
  id: 'cms-main',
  baseUrl: 'https://cms.example.com',
  auth: { in: 'header', name: 'Authorization', value: 'Bearer {{credential.token}}' },
  list: {
    path: '/api/{{resource}}',
    query: { 'pagination[start]': '{{offset}}', 'pagination[limit]': '{{limit}}', locale: '{{routeParams.lang}}' },
    itemsPath: 'data',
    totalPath: 'meta.pagination.total',
    idPath: 'documentId'
  },
  pagination: 'offset',
  operators: { eq: 'filters[{{field}}][$eq]={{value}}' }
};

const wordpress: ConnectorManifest = {
  id: 'wp',
  baseUrl: 'https://blog.example.com',
  list: { path: '/wp-json/wp/v2/{{resource}}', query: { per_page: '{{limit}}', page: '{{page}}' } },
  pagination: 'page'
};

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: () => Promise.resolve(body) }) as Response;

const strapiBody = {
  data: [
    { documentId: 'a1', title: 'First', cover: { url: '/uploads/a.png' } },
    { documentId: 'b2', title: 'Second', cover: null }
  ],
  meta: { pagination: { total: 7 } }
};

describe('fetchConnectorRecords', () => {
  it('builds the endpoint from the manifest template and the resource', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(strapiBody));

    await fetchConnectorRecords({ manifest: strapi, query: { resource: 'articles' }, fetchImpl });

    const url = new URL(fetchImpl.mock.calls[0][0] as string);

    expect(url.origin + url.pathname).toBe('https://cms.example.com/api/articles');
  });

  it('sends the credential through the declared auth header without it appearing in the URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(strapiBody));

    await fetchConnectorRecords({
      manifest: strapi,
      credential: { token: 's3cret' },
      query: { resource: 'articles' },
      fetchImpl
    });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];

    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer s3cret');
    expect(url).not.toContain('s3cret');
  });

  it('supports auth carried in the query string', async () => {
    const manifest: ConnectorManifest = {
      ...strapi,
      auth: { in: 'query', name: 'api_key', value: '{{credential.key}}' }
    };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(strapiBody));

    await fetchConnectorRecords({ manifest, credential: { key: 'abc' }, query: { resource: 'articles' }, fetchImpl });

    expect(new URL(fetchImpl.mock.calls[0][0] as string).searchParams.get('api_key')).toBe('abc');
  });

  it('translates paging into the provider vocabulary', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(strapiBody));

    await fetchConnectorRecords({ manifest: strapi, query: { resource: 'articles', offset: 20, limit: 5 }, fetchImpl });

    const params = new URL(fetchImpl.mock.calls[0][0] as string).searchParams;

    expect(params.get('pagination[start]')).toBe('20');
    expect(params.get('pagination[limit]')).toBe('5');
  });

  it('derives a page number for page-based providers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([]));

    await fetchConnectorRecords({
      manifest: wordpress,
      query: { resource: 'posts', offset: 20, limit: 10 },
      fetchImpl
    });

    expect(new URL(fetchImpl.mock.calls[0][0] as string).searchParams.get('page')).toBe('3');
  });

  it('interpolates route params into query values', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(strapiBody));

    await fetchConnectorRecords({
      manifest: strapi,
      query: { resource: 'articles', routeParams: { lang: 'es' } },
      fetchImpl
    });

    expect(new URL(fetchImpl.mock.calls[0][0] as string).searchParams.get('locale')).toBe('es');
  });

  it('drops a query parameter whose token never resolved instead of sending it raw', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(strapiBody));

    await fetchConnectorRecords({ manifest: strapi, query: { resource: 'articles' }, fetchImpl });

    expect(new URL(fetchImpl.mock.calls[0][0] as string).searchParams.has('locale')).toBe(false);
  });

  it('maps filters through the operator templates', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(strapiBody));

    await fetchConnectorRecords({
      manifest: strapi,
      query: { resource: 'articles', filters: [{ field: 'slug', operator: 'eq', value: 'hello' }] },
      fetchImpl
    });

    expect(new URL(fetchImpl.mock.calls[0][0] as string).searchParams.get('filters[slug][$eq]')).toBe('hello');
  });

  it('ignores a filter whose operator the connector does not declare', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(strapiBody));

    await fetchConnectorRecords({
      manifest: strapi,
      query: { resource: 'articles', filters: [{ field: 'slug', operator: 'contains', value: 'x' }] },
      fetchImpl
    });

    expect(new URL(fetchImpl.mock.calls[0][0] as string).search).not.toContain('contains');
  });

  it('normalizes records using the declared id path, keeping nested values intact', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(strapiBody));

    const { records } = await fetchConnectorRecords({ manifest: strapi, query: { resource: 'articles' }, fetchImpl });

    expect(records.map(record => record.id)).toEqual(['a1', 'b2']);
    expect(records[0].values).toEqual({ documentId: 'a1', title: 'First', cover: { url: '/uploads/a.png' } });
  });

  it('reads records from the response root when no itemsPath is declared', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ id: 9, title: 'Bare' }]));

    const { records } = await fetchConnectorRecords({ manifest: wordpress, query: { resource: 'posts' }, fetchImpl });

    expect(records).toEqual([{ id: '9', values: { id: 9, title: 'Bare' } }]);
  });

  it('unwraps values when the provider nests them', async () => {
    const manifest: ConnectorManifest = {
      ...strapi,
      list: { ...strapi.list, idPath: 'id', valuesPath: 'attributes' }
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ data: [{ id: 3, attributes: { title: 'Nested' } }], meta: { pagination: { total: 1 } } })
      );

    const { records } = await fetchConnectorRecords({ manifest, query: { resource: 'articles' }, fetchImpl });

    expect(records).toEqual([{ id: '3', values: { title: 'Nested' } }]);
  });

  it('reports paging from the declared total', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(strapiBody));

    const { pageInfo } = await fetchConnectorRecords({
      manifest: strapi,
      query: { resource: 'articles', limit: 2 },
      fetchImpl
    });

    expect(pageInfo).toMatchObject({ from: 0, to: 2, total: 7, hasNextPage: true, hasPrevPage: false });
  });

  it('infers there is another page when the provider reports no total', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ id: 1 }, { id: 2 }]));

    const { pageInfo } = await fetchConnectorRecords({
      manifest: wordpress,
      query: { resource: 'posts', limit: 2 },
      fetchImpl
    });

    expect(pageInfo.hasNextPage).toBe(true);
  });

  it('reports no next page on a short window', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ id: 1 }]));

    const { pageInfo } = await fetchConnectorRecords({
      manifest: wordpress,
      query: { resource: 'posts', limit: 10 },
      fetchImpl
    });

    expect(pageInfo.hasNextPage).toBe(false);
  });

  it('fails loudly on a provider error instead of returning an empty page', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'nope' }, false, 403));

    await expect(
      fetchConnectorRecords({ manifest: strapi, query: { resource: 'articles' }, fetchImpl })
    ).rejects.toThrow(/responded 403/);
  });

  it('tolerates a response whose items are not an array', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: null, meta: {} }));

    const { records } = await fetchConnectorRecords({ manifest: strapi, query: { resource: 'articles' }, fetchImpl });

    expect(records).toEqual([]);
  });

  it('reports the ordinal window so a pager can be rendered', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(strapiBody));

    const { pageInfo } = await fetchConnectorRecords({
      manifest: strapi,
      query: { resource: 'articles', limit: 2, offset: 4 },
      fetchImpl
    });

    expect(pageInfo.page).toBe(3);
    expect(pageInfo.pageCount).toBe(4);
  });

  // A provider that reports no total cannot say how many pages exist. Guessing one would render a pager that lies.
  it('leaves the page count unknown when the provider reports no total', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ id: 1 }, { id: 2 }]));

    const { pageInfo } = await fetchConnectorRecords({
      manifest: wordpress,
      query: { resource: 'posts', limit: 2 },
      fetchImpl
    });

    expect(pageInfo.pageCount).toBe(0);
  });
});

describe('rebaseMedia', () => {
  const media: ConnectorManifest = { ...strapi, media: { baseUrl: 'https://cdn.example.com/' } };

  it('rebases relative media paths onto the manifest media host', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(strapiBody));

    const { records } = await fetchConnectorRecords({ manifest: media, query: { resource: 'articles' }, fetchImpl });

    expect((records[0].values.cover as { url: string }).url).toBe('https://cdn.example.com/uploads/a.png');
  });

  it('walks nested objects and arrays', () => {
    const result = rebaseMedia(
      { formats: { thumbnail: { url: '/uploads/t.png' } }, gallery: [{ src: '/uploads/g.png' }] },
      'https://cdn.example.com'
    ) as { formats: { thumbnail: { url: string } }; gallery: { src: string }[] };

    expect(result.formats.thumbnail.url).toBe('https://cdn.example.com/uploads/t.png');
    expect(result.gallery[0].src).toBe('https://cdn.example.com/uploads/g.png');
  });

  // The rule is keyed on the property name precisely so prose that happens to start with a slash survives intact.
  it('leaves values whose key does not name a location alone', () => {
    const result = rebaseMedia({ body: '/not/a/media/path', slug: '/hello' }, 'https://cdn.example.com') as Record<
      string,
      string
    >;

    expect(result.body).toBe('/not/a/media/path');
    expect(result.slug).toBe('/hello');
  });

  it('leaves absolute and protocol-relative URLs untouched', () => {
    const result = rebaseMedia(
      { url: 'https://other.example.com/a.png', src: '//cdn.other.com/b.png' },
      'https://cdn.example.com'
    ) as Record<string, string>;

    expect(result.url).toBe('https://other.example.com/a.png');
    expect(result.src).toBe('//cdn.other.com/b.png');
  });
});
