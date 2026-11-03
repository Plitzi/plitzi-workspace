import { describe, expect, it } from 'vitest';

import { serverQueryOf, serverQueryProblem } from './serverQuery';

import type { ServerTemplateData } from './serverQuery';
import type { Element } from '../types';

const provider = (
  attributes: Record<string, unknown>,
  bound: string[] = []
): Pick<Element, 'attributes' | 'definition'> => ({
  attributes,
  definition: {
    type: 'apiContainer',
    bindings: { attributes: bound.map((to, index) => ({ id: `b${String(index)}`, to, source: 'state.token' })) }
    // A provider's definition holds more than a fixture needs; what this reads is its bindings.
  } as Element['definition']
});

const visit: ServerTemplateData = {
  variables: { apiUrl: 'https://api.example.com', cdnUrl: 'https://cdn.example.com' },
  routeParams: { id: '42' },
  queryParams: { page: '2' },
  origin: 'https://shop.example.com',
  paintedKeys: new Set(['workspace']),
  state: { workspace: { id: 5 } }
};

describe("a server provider's query, as the page server reads it", () => {
  it('reads a path of the space as a file, and another site’s address as a GET with the headers it declares', () => {
    expect(serverQueryOf(provider({ query: '/data/menu.json' }), visit)).toEqual({
      kind: 'path',
      path: '/data/menu.json'
    });

    const asked = serverQueryOf(
      provider({ query: 'https://api.example.com/items', headers: { Accept: 'application/json' }, accessToken: 'pk' }),
      visit
    );
    expect(asked?.kind === 'url' && asked.url.href).toBe('https://api.example.com/items');
    expect(asked?.kind === 'url' && asked.headers).toEqual({ Accept: 'application/json', Authorization: 'Bearer pk' });
  });

  // `{{ apiUrl }}` is the space's variable for this host and the route is the visit's: the server knows both.
  it('fills in a template over what the page server knows — the space’s variables, navigation — as the browser does', () => {
    const asked = serverQueryOf(
      provider({
        query: '{{ apiUrl }}/items/{{ navigation.routeParams.id }}?page={{ navigation.queryParams.page }}',
        accessToken: '{{ cdnUrl }}'
      }),
      visit
    );
    expect(asked?.kind === 'url' && asked.url.href).toBe('https://api.example.com/items/42?page=2');
    expect(asked?.kind === 'url' && asked.headers.Authorization).toBe('Bearer https://cdn.example.com');
    expect(serverQueryOf(provider({ query: '{{ navigation.origin }}/data/menu.json' }), visit)).toEqual({
      kind: 'url',
      url: new URL('https://shop.example.com/data/menu.json'),
      headers: {},
      asVisitor: false
    });
  });

  it('says why when the browser alone can ask it: bound, a template over the browser’s sources, a method', () => {
    const variables = new Set(['apiUrl']);
    const why = (attributes: Record<string, unknown>, bound: string[] = []) =>
      serverQueryProblem(provider(attributes, bound), variables);

    expect(why({ query: 'https://api.example.com/' }, ['accessToken'])).toContain('accessToken is bound');
    expect(why({ query: '{{ apiUrl }}/spaces/{{ spaceId }}' })).toContain('reads `spaceId`');
    expect(why({ query: '{{ apiUrl }}/me', accessToken: '{{ auth.accessToken }}' })).toContain('reads `auth`');
    expect(why({ query: 'https://api.example.com/', method: 'post' })).toContain('POST');
    expect(why({ query: '{{ apiUrl }}/items/{{ navigation.routeParams.id }}' })).toBeUndefined();
  });

  it('asks nothing for a template that comes to nothing, as the browser does not', () => {
    expect(
      serverQueryOf(provider({ query: "{{ navigation.queryParams.q ? apiUrl : '' }}" }), { ...visit, queryParams: {} })
    ).toBeUndefined();
  });

  // The browser keeps the token for later and asks once the key holds a value; the server, the same.
  it('asks nothing while a painted key it reads holds no value yet', () => {
    const query = '{{ apiUrl }}/workspaces/{{ state.workspace.id }}/stats';
    expect(serverQueryOf(provider({ query }), { ...visit, state: {} })).toBeUndefined();
    expect(serverQueryOf(provider({ query }), { ...visit, state: { workspace: { id: '' } } })).toBeUndefined();
    expect(serverQueryOf(provider({ query }), visit)?.kind).toBe('url');
  });

  // What the page starts from, the server knows for the keys the space paints — as the cookie holds them.
  it('reads the state the space paints, and says why for any other key of it', () => {
    const read = serverQueryOf(provider({ query: '{{ apiUrl }}/workspaces/{{ state.workspace.id }}/stats' }), visit);
    expect(read?.kind === 'url' && read.url.href).toBe('https://api.example.com/workspaces/5/stats');

    const why = (query: string) => serverQueryProblem(provider({ query }), new Set(['apiUrl']), new Set(['workspace']));
    expect(why('{{ apiUrl }}/x/{{ state.workspace.id }}')).toBeUndefined();
    expect(why('{{ apiUrl }}/x/{{ state.filter }}')).toContain('`state.filter`');
    expect(why('{{ apiUrl }}/x/{{ state.filter }}')).toContain('settings.paintedState');
    expect(serverQueryProblem(provider({ query: '{{ state.workspace.id }}' }), new Set())).toContain(
      '`state.workspace`'
    );
    // Followed by the server, never by the browser: it would not ask again when another workspace is picked.
    expect(why("{{ state.workspace.id ? apiUrl ~ '/x/' ~ state.workspace.id : '' }}")).toContain('token of its own');
  });

  // Whether the cookies may go where it comes to is the deployment's to say, on the visit (`rsc.visitorCredentials`).
  it('reads a query asked with the visitor’s cookies as one, and every other as a stranger’s', () => {
    const asVisitor = (credentials?: string) => {
      const read = serverQueryOf(
        provider({ query: '{{ apiUrl }}/me', ...(credentials ? { credentials } : {}) }),
        visit
      );

      return read?.kind === 'url' ? read.asVisitor : read?.kind;
    };

    expect(asVisitor('include')).toBe(true);
    expect(asVisitor('same-origin')).toBe(false);
    expect(asVisitor()).toBe(false);
  });

  it('says why when the address it comes to is no address: no protocol, neither a URL nor a path', () => {
    const why = (query: string) => {
      const read = serverQueryOf(provider({ query }), visit);

      return read?.kind === 'unresolved' ? read.why : read?.kind;
    };

    expect(why('//api.example.com/')).toContain('names no protocol');
    expect(why('items.json')).toContain('neither an address');
    expect(why('ftp://example.com/x')).toContain('ftp:');
  });

  it('is nothing for a provider with no query', () => {
    expect(serverQueryOf(provider({ action: 'list-posts' }), visit)).toBeUndefined();
    expect(serverQueryProblem(provider({ query: '' }), new Set())).toBeUndefined();
  });
});
