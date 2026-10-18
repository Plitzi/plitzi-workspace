import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import { createAuthoringHost } from '.';
import { unusedPort } from '../../core/unusedPort';
import { offlineDataOf, oneEmptyPage } from '../../modules/ssr/testing/offlineData';

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

/** What a live-pages stream says, as it says it. */
const listen = async (url: string) => {
  const reader = (await fetch(url)).body?.getReader();
  const decoder = new TextDecoder();
  let said = '';
  const more = async (): Promise<void> => {
    const chunk = await reader?.read();
    said += decoder.decode(chunk?.value);
  };

  return {
    heard: async (event: string): Promise<string> => {
      await vi.waitFor(
        async () => {
          await more();
          expect(said).toContain(`event: ${event}`);
        },
        { timeout: 5_000 }
      );

      return said;
    },
    /** What it said by the time anything else would have reached it: a read that waits, bounded. */
    said: async (): Promise<string> => {
      await Promise.race([more(), new Promise(resolve => setTimeout(resolve, 300))]);

      return said;
    },
    stop: () => reader?.cancel()
  };
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

    expect(weather).toEqual({ id: 'weather', path: '/?__pt=weather', updated: 0 });
    expect(agenda.id).toMatch(/^[\w-]{22}$/);

    const res = await fetch(`${base}${weather.path}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toBe('frame-ancestors https://app.example.test');
    expect(await res.text()).toContain('Weather');
    expect(await (await fetch(`${base}${agenda.path}`)).text()).toContain('Agenda');
    expect(host.ids().sort()).toEqual([agenda.id, 'weather'].sort());
  });

  /** What makes a page an agent keeps improving seen to grow: the open page is handed the new version, not reloaded. */
  it('hands the new version to the pages open at an id put again, and to them alone', async () => {
    const { host, base } = await start();
    host.put(offlineDataOf(titled('Draft one')), { id: 'weather' });
    host.put(offlineDataOf(titled('Agenda')), { id: 'agenda' });
    const page = await fetch(`${base}/?__pt=weather`);
    expect(await page.text()).toContain('/__plitzi/live?__pt=weather');

    const weather = await listen(`${base}/__plitzi/live?__pt=weather`);
    const agenda = await listen(`${base}/__plitzi/live?__pt=agenda`);
    await weather.heard('hello');
    await agenda.heard('hello');

    expect(host.put(offlineDataOf(titled('Draft two')), { id: 'weather' }).updated).toBe(1);
    expect(await weather.heard('space')).toContain('Draft two');
    expect(host.put(offlineDataOf(titled('New')), { id: 'fresh' }).updated).toBe(0);
    expect(await agenda.said()).not.toContain('event: space');
    await Promise.all([weather.stop(), agenda.stop()]);
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
