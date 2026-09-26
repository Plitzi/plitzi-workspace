import { beforeEach, describe, expect, it, vi } from 'vitest';

import { relayCache, relayPlugins } from './relay';
import { serverLog } from '../../../helpers/serverLog';

import type { CacheManager, PluginRegistry } from '@plitzi/sdk-shared';

/** The fleet as the relays see it: what they broadcast, and a way to play what another process broadcast. */
const fleet = vi.hoisted(() => {
  const listeners = new Map<string, (payload: unknown) => void>();

  return {
    sent: [] as [string, unknown][],
    listeners,
    hear: (channel: string, payload: unknown) => listeners.get(channel)?.(payload)
  };
});

vi.mock('./link', () => ({
  broadcast: (channel: string, payload: unknown) => fleet.sent.push([channel, payload]),
  onBroadcast: (channel: string, listener: (payload: unknown) => void) => {
    fleet.listeners.set(channel, listener);

    return () => fleet.listeners.delete(channel);
  }
}));

const fakeCache = () => {
  const cache = { invalidate: vi.fn(() => 3), clear: vi.fn(), size: 7 } satisfies CacheManager;

  return cache;
};

const fakePlugins = () => ({
  register: vi.fn<PluginRegistry['register']>(),
  invalidate: vi.fn<PluginRegistry['invalidate']>(() => Promise.resolve())
});

beforeEach(() => {
  fleet.sent.length = 0;
  fleet.listeners.clear();
});

describe('relayCache', () => {
  it('invalidates here, answers what it dropped here, and tells the others', () => {
    const cache = fakeCache();
    const relayed = relayCache(cache, 'SSR#0.cache');

    expect(relayed.invalidate({ spaceId: 42 })).toBe(3);
    expect(cache.invalidate).toHaveBeenCalledWith({ spaceId: 42 });
    expect(fleet.sent).toEqual([['SSR#0.cache', { op: 'invalidate', filter: { spaceId: 42 } }]]);
  });

  it('sends an invalidation with no filter as one that clears everything', () => {
    relayCache(fakeCache(), 'SSR#0.cache').invalidate();

    expect(fleet.sent).toEqual([['SSR#0.cache', { op: 'invalidate', filter: {} }]]);
  });

  it('clears here and tells the others', () => {
    const cache = fakeCache();
    relayCache(cache, 'SSR#0.cache').clear();

    expect(cache.clear).toHaveBeenCalled();
    expect(fleet.sent).toEqual([['SSR#0.cache', { op: 'clear' }]]);
  });

  it('reports the size of this process', () => {
    expect(relayCache(fakeCache(), 'SSR#0.cache').size).toBe(7);
  });

  it('applies what another process was told, without sending it on again', () => {
    const cache = fakeCache();
    relayCache(cache, 'SSR#0.cache');

    fleet.hear('SSR#0.cache', { op: 'invalidate', filter: { spaceId: 42, environment: 'production' } });
    fleet.hear('SSR#0.cache', { op: 'clear' });

    expect(cache.invalidate).toHaveBeenCalledWith({ spaceId: 42, environment: 'production' });
    expect(cache.clear).toHaveBeenCalled();
    expect(fleet.sent).toEqual([]);
  });

  it('keeps only the fields a filter has, of the types they have', () => {
    const cache = fakeCache();
    relayCache(cache, 'SSR#0.cache');

    fleet.hear('SSR#0.cache', { op: 'invalidate', filter: { spaceId: '42', hostname: 'a.example', extra: true } });

    expect(cache.invalidate).toHaveBeenCalledWith({ hostname: 'a.example' });
  });

  it('ignores what it does not recognise', () => {
    const cache = fakeCache();
    relayCache(cache, 'SSR#0.cache');

    fleet.hear('SSR#0.cache', null);
    fleet.hear('SSR#0.cache', 'clear');
    fleet.hear('SSR#0.cache', { op: 'drop' });

    expect(cache.invalidate).not.toHaveBeenCalled();
    expect(cache.clear).not.toHaveBeenCalled();
  });
});

describe('relayPlugins', () => {
  it('registers here and sends a file source on', () => {
    const plugins = fakePlugins();
    const relayed = relayPlugins(plugins, vi.fn(), 'SSR#0.plugins', 'SSR');
    const source = { js: '/plugins/chart.tsx', action: 'compile' as const, version: '2.0.0', props: { theme: 'dark' } };

    relayed.register('chart', source);

    expect(plugins.register).toHaveBeenCalledWith('chart', source);
    expect(fleet.sent).toEqual([['SSR#0.plugins', { op: 'register', name: 'chart', source }]]);
  });

  it('registers a component here only, and says so: the other workers will not have it', () => {
    const warn = vi.spyOn(serverLog, 'warn').mockImplementation(() => undefined);
    const plugins = fakePlugins();
    const relayed = relayPlugins(plugins, vi.fn(), 'SSR#0.plugins', 'SSR');

    relayed.register('inline', { component: () => null });

    expect(plugins.register).toHaveBeenCalledTimes(1);
    expect(fleet.sent).toEqual([]);
    expect(warn).toHaveBeenCalledWith('SSR', expect.stringContaining('only this process has it'));
    warn.mockRestore();
  });

  it('invalidates here — files included — and has the others forget it', async () => {
    const plugins = fakePlugins();
    const forget = vi.fn();
    const relayed = relayPlugins(plugins, forget, 'SSR#0.plugins', 'SSR');

    await relayed.invalidate('chart', '2.0.0');

    expect(plugins.invalidate).toHaveBeenCalledWith('chart', '2.0.0');
    expect(forget).not.toHaveBeenCalled();
    expect(fleet.sent).toEqual([['SSR#0.plugins', { op: 'forget', name: 'chart', version: '2.0.0' }]]);
  });

  it('applies another process’s register and forget, in memory, without sending them on', () => {
    const plugins = fakePlugins();
    const forget = vi.fn();
    relayPlugins(plugins, forget, 'SSR#0.plugins', 'SSR');

    fleet.hear('SSR#0.plugins', { op: 'register', name: 'chart', source: { js: '/c.js', action: 'copy', rogue: 1 } });
    fleet.hear('SSR#0.plugins', { op: 'forget', name: 'chart' });
    fleet.hear('SSR#0.plugins', { op: 'forget' });

    expect(plugins.register).toHaveBeenCalledWith('chart', { js: '/c.js', action: 'copy' });
    expect(forget).toHaveBeenNthCalledWith(1, 'chart', undefined);
    expect(forget).toHaveBeenNthCalledWith(2, undefined, undefined);
    expect(plugins.invalidate).not.toHaveBeenCalled();
    expect(fleet.sent).toEqual([]);
  });

  it('ignores a register it cannot make a source of', () => {
    const plugins = fakePlugins();
    relayPlugins(plugins, vi.fn(), 'SSR#0.plugins', 'SSR');

    fleet.hear('SSR#0.plugins', { op: 'register', name: 'chart', source: { css: '/c.css' } });
    fleet.hear('SSR#0.plugins', { op: 'register', source: { js: '/c.js' } });
    fleet.hear('SSR#0.plugins', { op: 'register', name: 'chart', source: { js: '/c.js', action: 'eval' } });

    expect(plugins.register).toHaveBeenCalledTimes(1);
    expect(plugins.register).toHaveBeenCalledWith('chart', { js: '/c.js' });
  });
});
