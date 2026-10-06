import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { dataLookupResolver, publicFileResolver } from './publicFileResolver';
import { dataDirLookup } from '../actions/runtime/projectData';

import type { RscResolveContext } from './resolveRscData';
import type { Element } from '@plitzi/sdk-shared';

let base: string;
let publicDir: string;

const provider = (query: unknown): Element => ({
  id: 'site',
  attributes: { query },
  definition: { label: 'Site', type: 'apiContainer', rootId: 'home', runtime: 'server', styleSelectors: { base: '' } }
});

// The resolver reads the element and the signal; the rest of a context is the request it never looks at.
const resolve = (query: unknown) =>
  publicFileResolver(publicDir)({
    element: provider(query),
    signal: new AbortController().signal
  } as RscResolveContext);

describe('publicFileResolver', () => {
  beforeAll(() => {
    base = mkdtempSync(path.join(tmpdir(), 'plitzi-public-'));
    publicDir = path.join(base, 'public');
    mkdirSync(path.join(publicDir, 'data'), { recursive: true });
    writeFileSync(path.join(publicDir, 'data/home.json'), JSON.stringify({ hero: { title: 'Hi' } }));
    writeFileSync(path.join(publicDir, 'data/broken.json'), '{ nope');
    writeFileSync(path.join(base, 'secret.json'), JSON.stringify({ key: 'do-not-serve' }));
  });

  afterAll(() => {
    rmSync(base, { recursive: true, force: true });
  });

  it('reads a file the server serves, as the browser would have fetched it', async () => {
    expect(await resolve('/data/home.json')).toEqual({ status: 200, data: { hero: { title: 'Hi' } } });
    expect(await resolve('/data/home.json?v=2#top')).toEqual({ status: 200, data: { hero: { title: 'Hi' } } });
  });

  it('leaves alone what is not a plain file of its own: a URL, a templated path', async () => {
    expect(await resolve('https://example.com/data.json')).toBeUndefined();
    expect(await resolve('//example.com/data.json')).toBeUndefined();
    expect(await resolve('/data/{{ navigation.routeParams.id }}.json')).toBeUndefined();
    expect(await resolve(undefined)).toBeUndefined();
  });

  it('never reads outside the folder it serves, however the path is written', async () => {
    expect(await resolve('/../secret.json')).toBeUndefined();
    expect(await resolve('/data/%2e%2e/%2e%2e/secret.json')).toBeUndefined();
    expect(await resolve('/%2e%2e/secret.json')).toBeUndefined();
  });

  it('answers a missing or unreadable file with the provider’s error state', async () => {
    expect(await resolve('/data/missing.json')).toBeNull();
    expect(await resolve('/data/broken.json')).toBeNull();
  });
});

/** A self-hosted server's `dataDir`, read through the lookup `createServer` derives from it — the one `ctx.data` reads. */
describe('dataLookupResolver over a data folder', () => {
  let dataDir: string;
  // A folder has no revisions, so the deployment the request carries plays no part in what is read.
  const resolveData = (query: unknown) =>
    dataLookupResolver(dataDirLookup(dataDir))({
      element: provider(query),
      spaceId: 1,
      environment: 'main',
      req: { ctx: {} },
      signal: new AbortController().signal
    } as unknown as RscResolveContext);

  beforeAll(() => {
    dataDir = mkdtempSync(path.join(tmpdir(), 'plitzi-data-'));
    mkdirSync(path.join(dataDir, 'shop'), { recursive: true });
    writeFileSync(path.join(dataDir, 'products.json'), JSON.stringify([{ id: 1, cost: 4 }]));
    writeFileSync(path.join(dataDir, 'shop/hours.json'), JSON.stringify({ open: 9 }));
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('reads `/data/<file>` from the project’s own folder, which nothing serves', async () => {
    expect(await resolveData('/data/products.json')).toEqual({ status: 200, data: [{ id: 1, cost: 4 }] });
    expect(await resolveData('/data/shop/hours.json')).toEqual({ status: 200, data: { open: 9 } });
  });

  it('is not asked for anything outside `/data/`, and reads nothing out of its folder', async () => {
    expect(await resolveData('/products.json')).toBeUndefined();
    expect(await resolveData('/data/../products.json')).toBeNull();
    expect(await resolveData('/data/%2e%2e/secret.json')).toBeNull();
    expect(await resolveData('/data/missing.json')).toBeNull();
  });
});

describe('dataLookupResolver', () => {
  const asked: unknown[] = [];
  const resolveFrom = (query: unknown, deployment?: { environment: string; revision: number }) =>
    dataLookupResolver((spaceId, at) => {
      asked.push({ spaceId, at });

      return Promise.resolve({ 'products.json': JSON.stringify([{ id: 1 }]), 'broken.json': '{ nope' });
    })({
      element: provider(query),
      spaceId: 7,
      environment: 'main',
      req: { ctx: { spaceDeployment: deployment } },
      signal: new AbortController().signal
    } as unknown as RscResolveContext);

  it('reads `/data/<file>` from the space’s data, of the version being rendered', async () => {
    expect(await resolveFrom('/data/products.json', { environment: 'production', revision: 3 })).toEqual({
      status: 200,
      data: [{ id: 1 }]
    });
    expect(asked.at(-1)).toEqual({ spaceId: 7, at: { environment: 'production', revision: 3 } });
    // The draft when no deployment says otherwise.
    await resolveFrom('/data/products.json');
    expect(asked.at(-1)).toEqual({ spaceId: 7, at: { environment: 'main', revision: 0 } });
  });

  it('answers a missing or unreadable file with the provider’s error state, and nothing outside `/data/`', async () => {
    expect(await resolveFrom('/data/missing.json')).toBeNull();
    expect(await resolveFrom('/data/broken.json')).toBeNull();
    expect(await resolveFrom('/products.json')).toBeUndefined();
  });
});
