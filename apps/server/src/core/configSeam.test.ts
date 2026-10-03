import { describe, expect, it, vi } from 'vitest';

import { connectorPresets } from '@plitzi/sdk-shared/connectors';

import { actionLookupsOf, connectorLookupsOf, dbDriversOf, functionsConfigOf } from './configSeam';

const manifest = () => {
  const found = connectorPresets.find(item => item.id === 'strapi');
  if (!found) {
    throw new Error('No strapi preset');
  }

  return structuredClone(found.manifest);
};

const document = {
  name: 'Send quote',
  enabled: true,
  output: { total: { type: 'number' } },
  nodes: {
    start: {
      id: 'start',
      type: 'trigger',
      action: 'call',
      params: { access: 'session', input: '{"amount":{"type":"number","required":true}}' },
      afterNode: 'ret'
    },
    ret: { id: 'ret', type: 'task', action: 'flow.output', params: { values: '{}' } }
  }
};

describe('connectorLookupsOf', () => {
  it('hands a manifest back under the id it was asked by, and nothing for one the store does not have', async () => {
    const stored = manifest();
    const lookups = connectorLookupsOf({ getConnector: (_, id) => Promise.resolve(id === 'cms' ? stored : undefined) });

    expect(await lookups.getConnector(1, 'cms')).toEqual({ ...stored, id: 'cms' });
    expect(await lookups.getConnector(1, 'other')).toBeUndefined();
  });

  it('refuses what is not a manifest, saying what is wrong with it', async () => {
    const lookups = connectorLookupsOf({
      getConnector: () => Promise.resolve({ ...manifest(), baseUrl: 'cms.example.com' })
    });

    await expect(lookups.getConnector(7, 'cms')).rejects.toThrow(
      /Connector "cms" of space 7 is not a manifest this server can run — baseUrl: /
    );
  });

  it('is one seam per config, checking a cached manifest once', async () => {
    const stored = manifest();
    const config = { getConnector: vi.fn(() => Promise.resolve(stored)) };

    expect(connectorLookupsOf(config)).toBe(connectorLookupsOf(config));
    await connectorLookupsOf(config).getConnector(1, 'cms');
    await connectorLookupsOf(config).getConnector(1, 'cms');

    expect(config.getConnector).toHaveBeenCalledTimes(2);
  });
});

describe('actionLookupsOf', () => {
  it('hands an action back, and refuses one that is not a document a server can run', async () => {
    const lookups = actionLookupsOf({
      getAction: (_, id) =>
        Promise.resolve(id === 'quote' ? { id, document } : { id, document: { ...document, nodes: 'none' } })
    });

    expect(await lookups.getAction(1, 'quote')).toEqual({ id: 'quote', document });
    await expect(lookups.getAction(1, 'broken')).rejects.toThrow(/Action "broken" of space 1 is not a document/);
  });

  it('leaves a broken action out of a list rather than failing the whole of it', async () => {
    const lookups = actionLookupsOf({
      getAction: () => Promise.resolve(undefined),
      listActions: () => Promise.resolve([{ id: 'quote', document }, { id: 'broken', document: {} }, 'nonsense'])
    });

    expect(await lookups.listActions?.(1)).toEqual([{ id: 'quote', document }]);
  });

  it('refuses functions that are not what sdk-server builds', async () => {
    const lookups = actionLookupsOf({
      getAction: () => Promise.resolve(undefined),
      getFunctions: () => Promise.resolve({ bundle: 'nope' })
    });

    await expect(lookups.getFunctions?.(3)).rejects.toThrow(/functions of space 3/);
  });
});

describe('the code a deployment hands in', () => {
  it('takes drivers that query, and names the one that does not', () => {
    const mysql = { engine: 'mysql', query: () => Promise.resolve([]) };

    expect(dbDriversOf([mysql])).toEqual([mysql]);
    expect(dbDriversOf(undefined)).toBeUndefined();
    expect(() => dbDriversOf([mysql, { engine: 'pg' }])).toThrow('action.dbDrivers[1] is not a database driver');
  });

  it('takes a functions config with a runner that describes and invokes, and refuses one that does not', () => {
    const runner = { describe: () => Promise.resolve({}), invoke: () => Promise.resolve(null) };

    expect(functionsConfigOf({ runner, limits: { cpuMs: 50 } })).toEqual({ runner, limits: { cpuMs: 50 } });
    expect(functionsConfigOf(undefined)).toBeUndefined();
    expect(() => functionsConfigOf({ runner: { invoke: () => null } })).toThrow('`functions` is not what');
  });
});
