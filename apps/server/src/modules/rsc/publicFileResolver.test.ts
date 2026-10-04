import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { publicFileResolver } from './publicFileResolver';

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
