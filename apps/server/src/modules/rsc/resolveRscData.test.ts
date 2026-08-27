import { describe, expect, it, vi } from 'vitest';

import { resolveRscData } from './resolveRscData';

import type { RscElementResolver } from './resolveRscData';
import type { Element, Schema, SSRRequest } from '@plitzi/sdk-shared';

const element = (
  id: string,
  type: string,
  items: string[] = [],
  runtime?: 'server' | 'client' | 'shared'
): Element => ({
  id,
  attributes: {},
  definition: { type, label: id, rootId: 'root', items, styleSelectors: { base: '' }, runtime }
});

const page = (id: string, slug: string, items: string[]): Element => ({
  id,
  attributes: { slug, folder: '', default: false },
  definition: { type: 'page', label: id, rootId: 'root', items, styleSelectors: { base: '' } }
});

const buildSchema = (): Schema => ({
  flat: {
    home: page('home', '', ['homeApi']),
    homeApi: element('homeApi', 'apiContainer', [], 'server'),
    post: page('post', 'blog/{{slug}}', ['postApi', 'postBox']),
    postApi: element('postApi', 'apiContainer', [], 'server'),
    postBox: element('postBox', 'container', ['postNested']),
    postNested: element('postNested', 'apiContainer', [], 'server'),
    postClient: element('postClient', 'apiContainer', [], 'client')
  },
  pages: ['home', 'post'],
  pageFolders: [],
  definition: { name: 'test', permanentUrl: 'test' },
  variables: [],
  settings: { customCss: '' }
});

const request = (path: string, query: Record<string, string> = {}): SSRRequest =>
  ({
    method: 'GET',
    path,
    search: '',
    url: path,
    hostname: 'x.test',
    protocol: 'https',
    headers: {},
    query,
    ctx: {}
  }) as unknown as SSRRequest;

const base = {
  spaceId: 1,
  environment: 'production' as const,
  user: undefined
};

describe('resolveRscData', () => {
  /**
   * The budget stops the WORK, not only the wait for it.
   *
   * A race leaves its loser running: an action went on to its own timeout — holding a run slot and an outbound
   * connection — for a page that had already been answered without it.
   */
  it('cancels an element that ran out of its budget', async () => {
    let seen: AbortSignal | undefined;
    const resolveElement = vi.fn<RscElementResolver>().mockImplementation(({ signal }) => {
      seen = signal;

      return new Promise(() => {
        // Never settles: the budget is the only thing that can end this one.
      });
    });

    const result = await resolveRscData({
      ...base,
      schema: buildSchema(),
      req: request('/'),
      resolveElement,
      timeoutMs: 10
    });

    expect(seen?.aborted, 'the work was left running for a page nobody is waiting on').toBe(true);
    expect(result.serverData).toEqual({});
  });

  it('leaves the signal alone for an element that answered in time', async () => {
    let seen: AbortSignal | undefined;
    const resolveElement = vi.fn<RscElementResolver>().mockImplementation(({ signal }) => {
      seen = signal;

      return Promise.resolve({ ok: true });
    });

    await resolveRscData({ ...base, schema: buildSchema(), req: request('/'), resolveElement });

    expect(seen?.aborted).toBe(false);
  });

  it('resolves only the server elements of the matched page', async () => {
    const resolveElement = vi
      .fn<RscElementResolver>()
      .mockImplementation(({ element }) => Promise.resolve({ from: element.id }));

    const result = await resolveRscData({
      ...base,
      schema: buildSchema(),
      req: request('/blog/hello'),
      resolveElement
    });

    expect(Object.keys(result.serverData ?? {}).sort()).toEqual(['postApi', 'postNested']);
  });

  it('reaches server elements nested under non-server containers', async () => {
    const resolveElement = vi.fn<RscElementResolver>().mockResolvedValue({ ok: true });

    const result = await resolveRscData({
      ...base,
      schema: buildSchema(),
      req: request('/blog/hello'),
      resolveElement
    });

    expect(result.serverData).toHaveProperty('postNested');
  });

  it('passes the route params of the matched page to the resolver', async () => {
    const resolveElement = vi.fn<RscElementResolver>().mockResolvedValue({});

    await resolveRscData({ ...base, schema: buildSchema(), req: request('/blog/hello'), resolveElement });

    expect(resolveElement.mock.calls[0][0].routeParams).toEqual({ slug: 'hello' });
  });

  it('passes query params through', async () => {
    const resolveElement = vi.fn<RscElementResolver>().mockResolvedValue({});

    await resolveRscData({
      ...base,
      schema: buildSchema(),
      req: request('/blog/hello', { page: '2' }),
      resolveElement
    });

    expect(resolveElement.mock.calls[0][0].queryParams).toEqual({ page: '2' });
  });

  it('restricts resolution to the requested ids', async () => {
    const resolveElement = vi.fn<RscElementResolver>().mockResolvedValue({ ok: true });

    const result = await resolveRscData({
      ...base,
      schema: buildSchema(),
      req: request('/blog/hello'),
      ids: ['postNested'],
      resolveElement
    });

    expect(Object.keys(result.serverData ?? {})).toEqual(['postNested']);
  });

  it('drops only the failing slice, keeping the rest of the page', async () => {
    const resolveElement = vi
      .fn<RscElementResolver>()
      .mockImplementation(({ element }) =>
        element.id === 'postApi' ? Promise.reject(new Error('provider down')) : Promise.resolve({ ok: true })
      );

    const result = await resolveRscData({
      ...base,
      schema: buildSchema(),
      req: request('/blog/hello'),
      resolveElement
    });

    expect(result.serverData).toEqual({ postNested: { ok: true } });
  });

  it('drops a slice that exceeds its time budget', async () => {
    const resolveElement = vi
      .fn<RscElementResolver>()
      .mockImplementation(({ element }) =>
        element.id === 'postApi'
          ? new Promise(resolve => setTimeout(() => resolve({ late: true }), 50))
          : Promise.resolve({ ok: true })
      );

    const result = await resolveRscData({
      ...base,
      schema: buildSchema(),
      req: request('/blog/hello'),
      resolveElement,
      timeoutMs: 10
    });

    expect(result.serverData).toEqual({ postNested: { ok: true } });
  });

  it('omits an element whose resolver returns undefined', async () => {
    const resolveElement = vi.fn<RscElementResolver>().mockResolvedValue(undefined);

    const result = await resolveRscData({
      ...base,
      schema: buildSchema(),
      req: request('/blog/hello'),
      resolveElement
    });

    expect(result.serverData).toEqual({});
  });

  it('returns nothing when rsc is disabled in the schema', async () => {
    const schema = { ...buildSchema(), rsc: { enabled: false } };
    const resolveElement = vi.fn<RscElementResolver>().mockResolvedValue({ ok: true });

    const result = await resolveRscData({ ...base, schema, req: request('/blog/hello'), resolveElement });

    expect(result).toEqual({});
    expect(resolveElement).not.toHaveBeenCalled();
  });

  it('resolves nothing when no page matches', async () => {
    const resolveElement = vi.fn<RscElementResolver>().mockResolvedValue({ ok: true });

    const result = await resolveRscData({ ...base, schema: buildSchema(), req: request('/nope'), resolveElement });

    expect(result.serverData).toEqual({});
    expect(resolveElement).not.toHaveBeenCalled();
  });
});
