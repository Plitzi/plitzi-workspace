import { describe, expect, it } from 'vitest';

import { parseRouteKey, readManifest } from './manifest';

const RESERVED = new Set(['kv', 'flow']);

describe('a route key', () => {
  it('is a method and a path of literal segments and params', () => {
    expect(parseRouteKey('GET /board-assets/:board/:asset')).toEqual({
      method: 'GET',
      segments: ['board-assets', ':board', ':asset']
    });
  });

  it('is nothing else', () => {
    ['FETCH /a', 'GET a', 'GET /a/../b', 'GET /a?x=1', 'GET /a/*', 'GET /a b'].forEach(key => {
      expect(parseRouteKey(key)).toBeUndefined();
    });
  });
});

describe('reading what a bundle declared', () => {
  it('keeps the serializable params a step editor draws, and says which it dropped', () => {
    const { manifest, problems } = readManifest(
      {
        hosts: ['api.example.com', '*.cdn.example.com'],
        tasks: [
          {
            namespace: 'feed',
            action: 'read',
            title: 'Read',
            params: {
              url: { type: 'text', label: 'URL', defaultValue: 'x', canBind: true },
              mode: { type: 'select', options: [{ label: 'A', value: 'a' }] },
              computed: { label: 'No type' }
            }
          }
        ],
        routes: ['GET /feed/:id']
      },
      RESERVED
    );

    expect(manifest.tasks[0]?.params).toEqual({
      url: { type: 'text', label: 'URL', defaultValue: 'x', canBind: true },
      mode: { type: 'select', options: [{ label: 'A', value: 'a' }] }
    });
    expect(problems).toEqual([expect.stringContaining('param "computed" has a type the builder cannot draw')]);
  });

  it('refuses a reserved namespace, a task twice, a bad host and two routes for the same requests', () => {
    const { problems } = readManifest(
      {
        hosts: ['http://api.example.com', 'localhost'],
        tasks: [
          { namespace: 'kv', action: 'get', title: 'Mine', params: {} },
          { namespace: 'feed', action: 'read', title: 'Read', params: {} },
          { namespace: 'feed', action: 'read', title: 'Again', params: {} }
        ],
        routes: ['GET /a/:x', 'GET /a/:y']
      },
      RESERVED
    );

    expect(problems).toEqual([
      expect.stringContaining('"http://api.example.com" is not a hostname'),
      expect.stringContaining('"localhost" is not a hostname'),
      'Namespace "kv" is reserved by another task set',
      'Task "feed.read" is declared twice',
      'Route "GET /a/:y" answers the same requests as another one'
    ]);
  });
});
