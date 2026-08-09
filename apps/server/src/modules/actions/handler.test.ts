import { describe, expect, it, vi } from 'vitest';

import { handleAction } from './handler';

import type { ConnectorManifest } from '../connectors/types';
import type { Element, SSRRequest, SSRResponseHelpers, SSRServerConfig } from '@plitzi/sdk-shared';

const manifest: ConnectorManifest = {
  id: 'cms',
  credential: 'cms-prod',
  baseUrl: 'https://cms.example.com',
  auth: { in: 'header', name: 'Authorization', value: 'Bearer {{credential.token}}' },
  endpoints: {
    read: { list: { path: '/api/{{resource}}', itemsPath: 'data', idPath: 'documentId' } },
    write: {
      create: {
        method: 'POST',
        path: '/api/{{resource}}',
        bodyPath: 'data',
        response: { itemsPath: 'data', idPath: 'documentId' }
      },
      update: {
        method: 'PUT',
        path: '/api/{{resource}}/{{id}}',
        bodyPath: 'data',
        response: { itemsPath: 'data', idPath: 'documentId' }
      }
    }
  }
};

const provider = (attributes: Record<string, unknown>, runtime: 'server' | 'client' = 'server'): Element => ({
  id: 'form1',
  attributes,
  definition: { type: 'apiContainer', label: 'Form', rootId: 'root', items: [], styleSelectors: { base: '' }, runtime }
});

const buildRes = () => {
  const sent: { status: number; body: string; headers: Record<string, string | string[]> } = {
    status: 200,
    body: '',
    headers: {}
  };
  const res: SSRResponseHelpers = {
    status: 200,
    headers: {},
    setHeader: (name, value) => {
      sent.headers[name] = value;
    },
    setStatus: code => {
      sent.status = code;
    },
    send: body => {
      sent.body = body;
    },
    write: () => undefined,
    end: () => undefined
  };

  return { res, sent };
};

const buildConfig = (element: Element | undefined): SSRServerConfig =>
  ({
    adapters: {
      getOfflineData: () =>
        Promise.resolve(element ? { schema: { flat: { form1: element } } } : { schema: { flat: {} } })
    }
  }) as unknown as SSRServerConfig;

const request = (body: unknown): SSRRequest =>
  ({
    method: 'POST',
    path: '/_action',
    body: JSON.stringify(body),
    query: {},
    headers: {},
    ctx: { spaceDeployment: { spaceId: 3, environment: 'production', revision: 1 } }
  }) as unknown as SSRRequest;

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: () => Promise.resolve(body) }) as Response;

const lookups = (fetchImpl: typeof fetch, override?: Partial<ConnectorManifest>) => ({
  getConnector: () => Promise.resolve({ ...manifest, ...override }),
  getCredential: () => Promise.resolve({ token: 'sup3rs3cret' }),
  fetchImpl
});

describe('handleAction', () => {
  it('writes through the connector and returns the created record', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: { documentId: 'new1', title: 'Hello' } }));
    const { res, sent } = buildRes();

    await handleAction(
      request({ elementId: 'form1', action: 'create', values: { title: 'Hello' } }),
      res,
      buildConfig(provider({ connector: 'cms', resource: 'messages' })),
      lookups(fetchImpl)
    );

    expect(sent.status).toBe(200);
    expect(JSON.parse(sent.body)).toEqual({ record: { id: 'new1', values: { documentId: 'new1', title: 'Hello' } } });
  });

  it('wraps the payload the way the provider expects', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: { documentId: 'n' } }));
    const { res } = buildRes();

    await handleAction(
      request({ elementId: 'form1', action: 'create', values: { title: 'Hello' } }),
      res,
      buildConfig(provider({ connector: 'cms', resource: 'messages' })),
      lookups(fetchImpl)
    );

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];

    expect(JSON.parse(init.body as string)).toEqual({ data: { title: 'Hello' } });
  });

  it('sends the credential server-side and keeps it out of the response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: { documentId: 'n' } }));
    const { res, sent } = buildRes();

    await handleAction(
      request({ elementId: 'form1', action: 'create', values: {} }),
      res,
      buildConfig(provider({ connector: 'cms', resource: 'messages' })),
      lookups(fetchImpl)
    );

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];

    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sup3rs3cret');
    expect(sent.body).not.toContain('sup3rs3cret');
  });

  it('substitutes the record id on update', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: { documentId: 'a1' } }));
    const { res } = buildRes();

    await handleAction(
      request({ elementId: 'form1', action: 'update', recordId: 'a1', values: { title: 'Edited' } }),
      res,
      buildConfig(provider({ connector: 'cms', resource: 'messages' })),
      lookups(fetchImpl)
    );

    expect(fetchImpl.mock.calls[0][0] as string).toBe('https://cms.example.com/api/messages/a1');
  });

  it('refuses an action the connector does not declare', async () => {
    const fetchImpl = vi.fn();
    const { res, sent } = buildRes();

    await handleAction(
      request({ elementId: 'form1', action: 'delete', recordId: 'a1' }),
      res,
      buildConfig(provider({ connector: 'cms', resource: 'messages' })),
      lookups(fetchImpl)
    );

    expect(sent.status).toBe(405);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses an element that is not in the published schema', async () => {
    const fetchImpl = vi.fn();
    const { res, sent } = buildRes();

    await handleAction(
      request({ elementId: 'form1', action: 'create', values: {} }),
      res,
      buildConfig(undefined),
      lookups(fetchImpl)
    );

    expect(sent.status).toBe(404);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses an element that is not server-driven', async () => {
    const fetchImpl = vi.fn();
    const { res, sent } = buildRes();

    await handleAction(
      request({ elementId: 'form1', action: 'create', values: {} }),
      res,
      buildConfig(provider({ connector: 'cms' }, 'client')),
      lookups(fetchImpl)
    );

    expect(sent.status).toBe(404);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a request that names no action', async () => {
    const fetchImpl = vi.fn();
    const { res, sent } = buildRes();

    await handleAction(
      request({ elementId: 'form1', values: {} }),
      res,
      buildConfig(provider({ connector: 'cms' })),
      lookups(fetchImpl)
    );

    expect(sent.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('allows a write named after the API rather than after CRUD', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: 'ticket-9' }));
    const { res, sent } = buildRes();

    await handleAction(
      request({ elementId: 'form1', action: 'escalate', values: { priority: 'high' } }),
      res,
      buildConfig(provider({ connector: 'cms', resource: 'tickets' })),
      lookups(fetchImpl, {
        endpoints: {
          ...manifest.endpoints,
          write: { escalate: { method: 'POST', path: '/api/{{resource}}/escalate' } }
        }
      })
    );

    expect(sent.status).toBe(200);
    expect(fetchImpl.mock.calls[0][0] as string).toBe('https://cms.example.com/api/tickets/escalate');
  });

  it('rejects a malformed body', async () => {
    const { res, sent } = buildRes();
    const req = request({});
    req.body = 'not json';

    await handleAction(req, res, buildConfig(provider({ connector: 'cms' })), lookups(vi.fn()));

    expect(sent.status).toBe(400);
  });

  it('does not leak the provider error to the browser', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'nope' }, false, 403));
    const { res, sent } = buildRes();

    await handleAction(
      request({ elementId: 'form1', action: 'create', values: {} }),
      res,
      buildConfig(provider({ connector: 'cms', resource: 'messages' })),
      lookups(fetchImpl)
    );

    expect(sent.status).toBe(502);
    expect(sent.body).not.toContain('cms.example.com');
  });

  it('never caches a write', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: { documentId: 'n' } }));
    const { res, sent } = buildRes();

    await handleAction(
      request({ elementId: 'form1', action: 'create', values: {} }),
      res,
      buildConfig(provider({ connector: 'cms', resource: 'messages' })),
      lookups(fetchImpl)
    );

    expect(sent.headers['Cache-Control']).toBe('no-store');
  });
});
