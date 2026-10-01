import { describe, expect, it } from 'vitest';

import { DEFAULT_FUNCTION_CEILINGS, functionLimitsFor } from './config';
import { parseRouteKey, readManifest } from './manifest';

const RESERVED = new Set(['kv', 'flow']);

const CEILINGS = DEFAULT_FUNCTION_CEILINGS;

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
      RESERVED,
      CEILINGS
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
      RESERVED,
      CEILINGS
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

describe('what a task asks for beyond the default', () => {
  const task = (limits: unknown) => ({ namespace: 'feed', action: 'read', title: 'Read', params: {}, limits });

  it('is kept, for one task or for all of them, within what the server allows', () => {
    const { manifest, problems } = readManifest(
      { tasks: [task({ cpuMs: 1000 })], routes: [], limits: { wallMs: 20_000 } },
      RESERVED,
      CEILINGS
    );

    expect(problems).toEqual([]);
    expect(manifest.tasks[0].limits).toEqual({ cpuMs: 1000 });
    expect(manifest.limits).toEqual({ wallMs: 20_000 });
  });

  it('is said to be too much rather than quietly cut down, and refused when it is not a time', () => {
    const { problems } = readManifest(
      { tasks: [task({ cpuMs: 60_000, wallMs: -1, timeout: 5 })], routes: [] },
      RESERVED,
      CEILINGS
    );

    expect(problems).toEqual([
      'Task "feed.read": asks for 60000 ms of CPU, and this server allows at most 2000 ms',
      'Task "feed.read": limits.wallMs is not a whole number of milliseconds above 0',
      'Task "feed.read": limits.timeout is not a limit a function asks for (cpuMs, wallMs)'
    ]);
  });

  it('is given — the default when nothing was asked — never above the plan nor the server', () => {
    expect(functionLimitsFor({}, {}, {})).toMatchObject({ cpuMs: 100, wallMs: 10_000 });
    expect(functionLimitsFor({}, {}, { cpuMs: 1000 })).toMatchObject({ cpuMs: 1000, wallMs: 10_000 });
    expect(functionLimitsFor({ cpuMs: 500 }, {}, { cpuMs: 1000 })).toMatchObject({ cpuMs: 500 });
    expect(functionLimitsFor({}, { cpuMs: 300 }, { cpuMs: 1000 })).toMatchObject({ cpuMs: 300 });
  });
});
