import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { createAuthoringHost } from '.';
import { unusedPort } from '../../core/unusedPort';
import { offlineDataOf, oneEmptyPage } from '../ssr/testing/offlineData';

import type { AuthoringHost } from '.';
import type { Schema } from '@plitzi/sdk-shared';

/**
 * Pages somebody else authored, each at its own address on one server, over real HTTP: served from what `put` was
 * handed, kept across a restart, gone once dropped — and nothing else on the host answers.
 */

const dir = mkdtempSync(path.join(tmpdir(), 'plitzi-authoring-host-'));

const titled = (title: string): Schema => ({ ...oneEmptyPage, definition: { name: title, permanentUrl: 'page' } });

const started: AuthoringHost[] = [];

const start = async (): Promise<{ host: AuthoringHost; base: string }> => {
  const port = await unusedPort();
  const host = createAuthoringHost({ dir, port, devMode: true, frameAncestors: ['https://app.example.test'] });
  await host.server.listen(port, '127.0.0.1');
  started.push(host);

  return { host, base: `http://127.0.0.1:${String(port)}` };
};

afterEach(async () => {
  await Promise.all(started.splice(0).map(host => host.server.close()));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('createAuthoringHost', () => {
  it('serves each page it is handed at the address it answers, framed only by who it names', async () => {
    const { host, base } = await start();
    const weather = host.put(offlineDataOf(titled('Weather')), { id: 'weather' });
    const agenda = host.put(offlineDataOf(titled('Agenda')));

    expect(weather).toEqual({ id: 'weather', path: '/?__pt=weather' });
    expect(agenda.id).toMatch(/^[\w-]{22}$/);

    const res = await fetch(`${base}${weather.path}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toBe('frame-ancestors https://app.example.test');
    expect(await res.text()).toContain('Weather');
    expect(await (await fetch(`${base}${agenda.path}`)).text()).toContain('Agenda');
    expect(host.ids().sort()).toEqual([agenda.id, 'weather'].sort());
  });

  it('answers nothing but its pages, and says where they are', async () => {
    const { base } = await start();

    const bare = await fetch(`${base}/`);
    expect(bare.status).toBe(404);
    expect(await bare.text()).toContain('/?__pt=<id>');
    expect((await fetch(`${base}/?__pt=nobody`)).status).toBe(404);
  });

  it('keeps its pages across a restart, and forgets one dropped', async () => {
    const first = await start();
    first.host.put(offlineDataOf(titled('Kept')), { id: 'kept' });
    await first.host.server.close();
    started.splice(0);

    const { host, base } = await start();
    expect(await (await fetch(`${base}/?__pt=kept`)).text()).toContain('Kept');

    expect(host.drop('kept')).toBe(true);
    expect(host.drop('kept')).toBe(false);
    expect((await fetch(`${base}/?__pt=kept`)).status).toBe(404);
  });

  it('refuses an id that could be read as a path, and leaves out a file it did not write', async () => {
    writeFileSync(path.join(dir, 'stray.json'), '{ "not": "a page" }');
    const { host } = await start();

    expect(() => host.put(offlineDataOf(), { id: '../escape' })).toThrow('letters, digits');
    expect(host.ids()).not.toContain('stray');
  });
});
