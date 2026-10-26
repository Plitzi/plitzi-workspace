import { describe, expect, it, vi } from 'vitest';

import { RSC_FAILURE } from '@plitzi/sdk-shared/schema';

import { resolveRscData } from './resolveRscData';

import type { RscElementResolver } from './resolveRscData';
import type { Element, Schema, SSRRequest, SSRUser } from '@plitzi/sdk-shared';

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
  components: {},
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

  /** The browser that asked stopped waiting — a newer refresh, a STOP — and the work it asked for stops with it. */
  it('cancels every element still resolving when whoever asked hangs up', async () => {
    let seen: AbortSignal | undefined;
    const asked = new AbortController();
    const resolveElement = vi.fn<RscElementResolver>().mockImplementation(({ signal }) => {
      seen = signal;

      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')));
        asked.abort();
      });
    });

    const result = await resolveRscData({
      ...base,
      schema: buildSchema(),
      req: request('/'),
      resolveElement,
      signal: asked.signal
    });

    expect(seen?.aborted).toBe(true);
    expect(result.serverData).toEqual({});
  });

  it('names the setting that gives a slow element more time', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const resolveElement = vi.fn<RscElementResolver>().mockImplementation(() => new Promise(() => undefined));

    await resolveRscData({ ...base, schema: buildSchema(), req: request('/'), resolveElement, timeoutMs: 10 });

    expect(JSON.stringify(errors.mock.calls)).toContain('elementTimeoutMs');
    errors.mockRestore();
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

  // A session action with no render trigger failed 'forbidden' in a log, the page saying "could not be reached".
  it('says a failed element’s reason in its data while developing, and leaves it out otherwise', async () => {
    const resolveElement = vi
      .fn<RscElementResolver>()
      .mockImplementation(({ element }) =>
        element.id === 'postApi'
          ? Promise.reject(new Error('Action "post" has no "render" trigger'))
          : Promise.resolve({ ok: 1 })
      );
    const asked = { ...base, schema: buildSchema(), req: request('/blog/hello'), resolveElement };

    expect((await resolveRscData({ ...asked, sayFailures: true })).serverData?.postApi).toEqual({
      [RSC_FAILURE]: 'Action "post" has no "render" trigger'
    });
    expect(Object.keys((await resolveRscData(asked)).serverData ?? {})).toEqual(['postNested']);
  });

  // A guest's every room page logged an error with its stack for data the action rightly refused them.
  it('says an element an action refused this visitor as a warning line, and anything else as an error', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const refused = Object.assign(new Error('Action "people" ended as failed, refused (not-host): For the host.'), {
      refused: true,
      said: 'For the host.'
    });
    const resolveElement = vi
      .fn<RscElementResolver>()
      .mockImplementation(({ element }) =>
        element.id === 'postApi' ? Promise.reject(refused) : Promise.reject(new Error('socket hang up'))
      );

    const { serverData } = await resolveRscData({
      ...base,
      schema: buildSchema(),
      req: request('/blog/hello'),
      resolveElement
    });

    // The refusal's words alone, for the visitor — published too, as `/_action` answers them; a page had to split
    // "Action … refused (code): " off to show them. A failure that is no refusal is not said there.
    expect(serverData?.postApi).toEqual({ [RSC_FAILURE]: 'For the host.' });
    expect(serverData?.postNested).toBeUndefined();
    expect(JSON.stringify(warnings.mock.calls)).toContain(
      'element postApi: Action \\"people\\" ended as failed, refused (not-host)'
    );
    expect(JSON.stringify(errors.mock.calls)).not.toContain('postApi');
    expect(JSON.stringify(errors.mock.calls)).toContain('postNested failed to resolve');
    errors.mockRestore();
    warnings.mockRestore();
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

  it('resolves nothing under an element a flag switched off, and follows the overrides', async () => {
    const gatedSchema = (): Schema => {
      const schema = buildSchema();
      schema.flags = { newPost: { value: false, rules: [] } };
      schema.flat.postBox = {
        ...schema.flat.postBox,
        definition: { ...schema.flat.postBox.definition, flag: { name: 'newPost', is: true } }
      };

      return schema;
    };
    const resolvedIds = async (flagOverrides?: { qa: Record<string, boolean> }) => {
      const resolveElement = vi.fn<RscElementResolver>().mockResolvedValue({});
      await resolveRscData({
        ...base,
        schema: gatedSchema(),
        req: request('/blog/hello'),
        resolveElement,
        ...(flagOverrides ? { flagOverrides } : {})
      });

      return resolveElement.mock.calls.map(([context]) => context.element.id);
    };

    expect(await resolvedIds()).toEqual(['postApi']);
    expect((await resolvedIds({ qa: { newPost: true } })).sort()).toEqual(['postApi', 'postNested']);
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

  // A guest's page resolved the room's people — `when` on `roomData.found`, even on `auth.isAuthenticated` — whatever
  // it said: the page server read no provider's `when`.
  describe('a provider’s `when`', () => {
    const when = (field: string, value: unknown) => ({ combinator: 'and', rules: [{ field, operator: '=', value }] });
    const gated = (id: string, rule: ReturnType<typeof when>): Element => ({
      ...element(id, 'apiContainer', [], 'server'),
      attributes: { when: rule }
    });
    const roomSchema = (): Schema => {
      const schema = buildSchema();
      schema.flat.room = page('room', 'r/{{slug}}', ['roomData']);
      schema.flat.roomData = element('roomData', 'apiContainer', ['roomPeople', 'myRequests', 'drafts'], 'server');
      schema.flat.roomPeople = gated('roomPeople', when('apiContainer_roomData.found', true));
      schema.flat.myRequests = gated('myRequests', when('auth.isAuthenticated', true));
      schema.flat.drafts = gated('drafts', when('state.editing', true));
      schema.pages = [...schema.pages, 'room'];

      return schema;
    };

    it('is held by the page server: the visitor, and the answers of the providers it reads, first', async () => {
      const order: string[] = [];
      const resolveElement = vi.fn<RscElementResolver>().mockImplementation(({ element: { id } }) => {
        order.push(id);

        return Promise.resolve(id === 'roomData' ? { found: true } : { id });
      });

      const guest = await resolveRscData({ ...base, schema: roomSchema(), req: request('/r/night'), resolveElement });

      expect(guest.serverData).toEqual({
        roomData: { found: true },
        roomPeople: { id: 'roomPeople' },
        drafts: { id: 'drafts' }
      });
      expect(order.indexOf('roomData')).toBeLessThan(order.indexOf('roomPeople'));

      const user = {
        token: 't',
        id: 1,
        username: 'ana',
        email: 'a@x.test',
        verified: true,
        permissions: [],
        roles: []
      };
      const signedIn = await resolveRscData({
        ...base,
        user,
        schema: roomSchema(),
        req: request('/r/night'),
        resolveElement
      });
      expect(signedIn.serverData).toHaveProperty('myRequests', { id: 'myRequests' });
    });

    it('leaves out one whose provider answered no, and resolves one it reads to decide, asked alone', async () => {
      const resolveElement = vi
        .fn<RscElementResolver>()
        .mockImplementation(({ element: { id } }) => Promise.resolve(id === 'roomData' ? { found: false } : { id }));

      const result = await resolveRscData({
        ...base,
        schema: roomSchema(),
        req: request('/r/night'),
        ids: ['roomPeople'],
        resolveElement
      });

      expect(result.serverData).toEqual({});
      expect(resolveElement.mock.calls.map(([context]) => context.element.id)).toEqual(['roomData']);
    });
  });

  const withheldModeration = (): Schema => ({
    ...buildSchema(),
    flat: {
      moderation: {
        ...page('moderation', 'moderation', ['reportsApi']),
        attributes: {
          slug: 'moderation',
          folder: '',
          default: false,
          layout: 'shell',
          layoutContainer: 'shellBody',
          access: { permissions: ['moderate'] }
        }
      },
      reportsApi: element('reportsApi', 'apiContainer', [], 'server'),
      shell: {
        id: 'shell',
        attributes: {},
        definition: {
          type: 'layoutContainer',
          label: 'shell',
          rootId: 'shell',
          items: ['header', 'shellBody'],
          styleSelectors: { base: '' }
        }
      },
      header: element('header', 'container', ['unreadApi']),
      unreadApi: element('unreadApi', 'apiContainer', [], 'server'),
      shellBody: element('shellBody', 'container')
    },
    pages: ['moderation']
  });

  // A run's page withheld from a signed-in visitor drew the site's header with a blank avatar and no inbox: every
  // layout source "could not be reached" — the page's refusal kept the layout's data back with its own.
  it('reads the layout around a page withheld from this visitor, and nothing of the page', async () => {
    const withLayout = withheldModeration();
    const asked: string[] = [];
    const resolveElement = vi.fn<RscElementResolver>().mockImplementation(({ element: each }) => {
      asked.push(each.id);

      return Promise.resolve({ unread: 2 });
    });
    const signedIn = { id: 7, username: 'mika', permissions: [], roles: [] } as unknown as SSRUser;

    const result = await resolveRscData({
      ...base,
      user: signedIn,
      schema: withLayout,
      req: request('/moderation'),
      resolveElement
    });

    expect(asked).toEqual(['unreadApi']);
    expect(result.serverData).toEqual({ unreadApi: { unread: 2 } });
  });

  it('reads the page the space draws in place of one withheld, as the browser is sent it', async () => {
    const withheld = withheldModeration();
    const schema = {
      ...withheld,
      settings: { ...withheld.settings, withheldPage: 'noAccess' },
      flat: {
        ...withheld.flat,
        noAccess: page('noAccess', 'no-access', ['whoApi']),
        whoApi: element('whoApi', 'apiContainer', [], 'server')
      },
      pages: ['moderation', 'noAccess']
    } as Schema;
    const asked: string[] = [];
    const resolveElement = vi.fn<RscElementResolver>().mockImplementation(({ element: each }) => {
      asked.push(each.id);

      return Promise.resolve({ ok: true });
    });

    await resolveRscData({
      ...base,
      user: { id: 7, username: 'mika', permissions: [], roles: [] } as unknown as SSRUser,
      schema,
      req: request('/moderation'),
      resolveElement
    });

    expect(asked.sort()).toEqual(['unreadApi', 'whoApi']);
  });

  // A room's crate bound its person to the room's answer: the page server asked with none, refused on every load.
  it('resolves an input bound to another server provider after it, as the browser would', async () => {
    const schema = buildSchema();
    schema.flat.home = page('home', '', ['roomApi', 'crateApi']);
    schema.flat.roomApi = element('roomApi', 'apiContainer', [], 'server');
    schema.flat.crateApi = {
      ...element('crateApi', 'apiContainer', [], 'server'),
      definition: {
        ...element('crateApi', 'apiContainer', [], 'server').definition,
        bindings: {
          attributes: [
            {
              id: 'b1',
              to: 'input',
              source: 'apiContainer_roomApi.data.host',
              transformers: [
                { action: 'twigTemplate', params: { template: '{{ { username: source } }}', returnMode: 'value' } }
              ]
            }
          ]
        }
      }
    };
    const inputs: Record<string, unknown> = {};
    const resolveElement = vi.fn<RscElementResolver>().mockImplementation(({ element: each, input }) => {
      inputs[each.id] = input;

      return Promise.resolve(each.id === 'roomApi' ? { data: { host: 'dax' } } : { data: [] });
    });

    await resolveRscData({ ...base, schema, req: request('/'), resolveElement });

    expect(inputs.crateApi).toEqual({ username: 'dax' });
  });
});
