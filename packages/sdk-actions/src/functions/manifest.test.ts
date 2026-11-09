import { describe, expect, it } from 'vitest';

import { DEFAULT_FUNCTION_CEILINGS, functionLimitsFor, functionSizeRefusal } from './config';
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
              url: { type: 'text', label: 'URL', defaultValue: 'x', canBind: true, required: true, maxLength: 200 },
              mode: { type: 'select', options: [{ label: 'A', value: 'a' }] },
              count: { type: 'number', label: 'Count', defaultValue: 1, min: 1, max: 'ten' },
              tags: { type: 'list', label: 'Tags', defaultValue: ['news', 3], maxItems: 5 },
              computed: { label: 'No type' }
            }
          }
        ],
        routes: ['GET /feed/:id']
      },
      RESERVED,
      CEILINGS
    );

    // The rules a task declares travel with it — the runner checks them before the code runs — and only as numbers.
    expect(manifest.tasks[0]?.params).toEqual({
      url: { type: 'text', label: 'URL', defaultValue: 'x', canBind: true, required: true, maxLength: 200 },
      mode: { type: 'select', options: [{ label: 'A', value: 'a' }] },
      count: { type: 'number', label: 'Count', defaultValue: 1, min: 1 },
      tags: { type: 'list', label: 'Tags', defaultValue: ['news'], maxItems: 5 }
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
      'Task "feed.read": limits.timeout is not a limit a function asks for (cpuMs, wallMs, size)'
    ]);
  });

  it('asks for a size by its name, within what the server allows', () => {
    const { manifest, problems } = readManifest(
      { tasks: [task({ size: 'large' })], routes: [], limits: { size: 'medium' } },
      RESERVED,
      CEILINGS
    );
    const refused = readManifest(
      { tasks: [task({ size: 'large' }), { ...task({ size: 'huge' }), action: 'other' }], routes: [] },
      RESERVED,
      { ...CEILINGS, memoryMb: 128 }
    );

    expect(problems).toEqual([]);
    expect(manifest.tasks[0].limits).toEqual({ size: 'large' });
    expect(manifest.limits).toEqual({ size: 'medium' });
    expect(refused.problems).toEqual([
      'Task "feed.read": asks to be large (256 MB of memory), and this server allows up to medium',
      'Task "feed.other": limits.size is not a size (small, medium, large)'
    ]);
  });

  it('is given — the default when nothing was asked — never above the plan nor the server', () => {
    expect(functionLimitsFor({}, {}, {})).toMatchObject({ cpuMs: 100, wallMs: 10_000 });
    expect(functionLimitsFor({}, {}, { cpuMs: 1000 })).toMatchObject({ cpuMs: 1000, wallMs: 10_000 });
    expect(functionLimitsFor({ cpuMs: 500 }, {}, { cpuMs: 1000 })).toMatchObject({ cpuMs: 500 });
    expect(functionLimitsFor({}, { cpuMs: 300 }, { cpuMs: 1000 })).toMatchObject({ cpuMs: 300 });
  });

  // The runner keeps an invocation's memory whole while it runs: given the plan's 256 MB each, a runner of 1 GB ran
  // two at once under load, and the rest waited. The plan's is the largest size a task may ask for.
  it('runs a task at the size it asked for — small when it asked for none — and the plan’s only as the most', () => {
    const plan = { memoryMb: 256 };

    expect(functionLimitsFor({}, plan, {}).memoryMb).toBe(32);
    expect(functionLimitsFor({}, plan, { size: 'medium' }).memoryMb).toBe(128);
    expect(functionLimitsFor({}, plan, { size: 'large' }).memoryMb).toBe(256);
  });

  // Never quietly smaller: a size the plan leaves out is said before the task runs, with the size that fits.
  it('refuses a size its plan or its server does not include, naming the one that fits', () => {
    expect(functionSizeRefusal({}, { memoryMb: 256 }, { size: 'large' })).toBeUndefined();
    expect(functionSizeRefusal({}, { memoryMb: 128 }, { size: 'large' })).toBe(
      'This task asks to be large (256 MB of memory), and its space’s plan allows up to medium (128 MB): ask for a size that fits in its limits, or for a plan that includes large'
    );
    expect(functionSizeRefusal({ memoryMb: 32 }, {}, { size: 'medium' })).toBe(
      'This task asks to be medium (128 MB of memory), and this server allows up to small (32 MB): ask for a size that fits in its limits, or for a plan that includes medium'
    );
  });
});

describe('the OAuth connections a bundle declared', () => {
  const read = (oauth: unknown, scope?: { plugin: string }) =>
    readManifest({ hosts: [], tasks: [], routes: [], oauth }, RESERVED, CEILINGS, scope);

  /** Any provider, as data: an OpenID issuer, or the endpoints of one that publishes none. */
  it('keeps each connection a provider is reached by, its issuer or its endpoints', () => {
    const { manifest, problems } = read({
      calendar: {
        issuer: 'https://accounts.example.com',
        credential: 'cal',
        scopes: ['read'],
        authorizeParams: { prompt: 'consent' }
      },
      music: {
        authorizeUrl: 'https://music.example.com/authorize',
        tokenUrl: 'https://music.example.com/api/token',
        credential: 'music-app',
        clientAuth: 'basic',
        exposeToken: true
      }
    });

    expect(problems).toEqual([]);
    expect(manifest.oauth).toEqual({
      calendar: {
        issuer: 'https://accounts.example.com',
        credential: 'cal',
        scopes: ['read'],
        authorizeParams: { prompt: 'consent' }
      },
      music: {
        authorizeUrl: 'https://music.example.com/authorize',
        tokenUrl: 'https://music.example.com/api/token',
        credential: 'music-app',
        clientAuth: 'basic',
        exposeToken: true
      }
    });
  });

  it('says what is wrong with each, and leaves that one out', () => {
    const { manifest, problems } = read({
      'no endpoint': { credential: 'x' },
      plain: { issuer: 'http://insecure.example.com', credential: 'x' },
      nameless: { issuer: 'https://id.example.com' },
      overriding: {
        issuer: 'https://id.example.com',
        credential: 'x',
        authorizeParams: { redirect_uri: 'https://evil' }
      },
      loose: { issuer: 'https://id.example.com', credential: 'x', exposeToken: 'yes' },
      good: { issuer: 'https://id.example.com', credential: 'x' }
    });

    expect(problems).toEqual([
      'OAuth connection "no endpoint": a name is a letter, then letters, digits and "-", up to 64',
      'OAuth connection "no endpoint": an issuer (OpenID), or its authorizeUrl and tokenUrl',
      'OAuth connection "plain": issuer is an https URL',
      'OAuth connection "plain": an issuer (OpenID), or its authorizeUrl and tokenUrl',
      'OAuth connection "nameless" names no credential: the space\'s credential with the app\'s clientId and clientSecret',
      'OAuth connection "overriding": authorizeParams.redirect_uri is the platform\'s to write',
      'OAuth connection "loose": exposeToken is true or false'
    ]);
    expect(Object.keys(manifest.oauth ?? {})).toEqual(['good']);
  });

  it('refuses them in a plugin, and a route where the platform answers the visitor back', () => {
    expect(read({ x: { issuer: 'https://id.example.com', credential: 'x' } }, { plugin: 'board' }).problems).toEqual([
      'The functions of a plugin declare no OAuth connections: only its space does (oauth)'
    ]);
    expect(readManifest({ routes: ['GET /oauth/callback'] }, RESERVED, CEILINGS).problems).toEqual([
      'Route "GET /oauth/callback" is /oauth/callback, where the platform answers the visitor back from an OAuth provider'
    ]);
  });
});
