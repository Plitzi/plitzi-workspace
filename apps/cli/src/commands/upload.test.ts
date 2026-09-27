import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { strToU8, zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readConnection, writeConnection } from '../account/connection';
import { fakePlatform } from '../account/fakePlatform';

import type { FakePlatform } from '../account/fakePlatform';

/**
 * `plitzi upload plugin`: to the connected space and no other, with signing in and choosing the space done in the
 * browser when there is no connection yet — and nothing sent that the platform would refuse anyway.
 */

let platform: FakePlatform;
let home: string;
const browser = vi.fn();

vi.mock('../account/oauth', async importOriginal => ({
  ...(await importOriginal<typeof import('../account/oauth')>()),
  openBrowser: (url: string) => browser(url) as unknown
}));

const { default: uploadPluginCommand } = await import('./uploadPlugin');

const said = { out: '', err: '' };

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-upload-'));
  process.env.XDG_CONFIG_HOME = path.join(home, 'config');
  platform = await fakePlatform();
  browser.mockImplementation(platform.browser);
  said.out = '';
  said.err = '';
  vi.spyOn(console, 'log').mockImplementation((line: string) => {
    said.out += `${line}\n`;
  });
  vi.spyOn(console, 'error').mockImplementation((line: string) => {
    said.err += `${line}\n`;
  });
  process.exitCode = undefined;
});

afterEach(async () => {
  vi.restoreAllMocks();
  browser.mockReset();
  await platform.close();
  delete process.env.XDG_CONFIG_HOME;
  process.exitCode = undefined;
  await fs.rm(home, { recursive: true, force: true });
});

const writeZip = async (name: string, files: Record<string, string>): Promise<string> => {
  const target = path.join(home, name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(
    target,
    zipSync(Object.fromEntries(Object.entries(files).map(([file, contents]) => [file, strToU8(contents)])))
  );

  return target;
};

const pluginZip = (name = 'seat-picker-1.2.0.zip') =>
  writeZip(name, {
    'seat-picker.mjs': 'export default {};',
    'plugin-manifest.json': JSON.stringify({ root: 'seatPicker', version: '1.2.0' })
  });

describe('plitzi upload plugin', () => {
  it('signs in and has the space chosen in the browser when there is no connection, then uploads to it', async () => {
    await uploadPluginCommand(await pluginZip(), { api: platform.api });

    expect(platform.scopes).toEqual(['space']);
    expect(platform.uploads).toEqual([
      {
        path: '/spaces/3/cdns/cdn-main/plugins?filename=seat-picker-1.2.0.zip',
        contentType: 'application/zip',
        bytes: expect.any(Number) as number
      }
    ]);
    expect(said.out).toContain('Website loads seatPicker 1.2.0 from now on');
    expect(process.exitCode).toBeUndefined();
  });

  it('goes to the browser only to choose a space, when signed in without one', async () => {
    await writeConnection({ api: platform.api, grant: { clientId: 'c', accessToken: 'old', refreshToken: 'r-old' } });

    await uploadPluginCommand(await pluginZip(), { api: platform.api });

    expect(platform.scopes).toEqual(['space']);
    expect((await readConnection())?.space?.id).toBe(3);
    expect(platform.uploads).toHaveLength(1);
  });

  it('skips the browser altogether while the connection to a space works', async () => {
    platform.valid.add('live');
    await writeConnection({
      api: platform.api,
      grant: { clientId: 'c', accessToken: 'live' },
      space: { id: 3, name: 'Website', permanentUrl: 'website' }
    });

    await uploadPluginCommand(await pluginZip(), { api: platform.api });

    expect(browser).not.toHaveBeenCalled();
    expect(platform.uploads).toHaveLength(1);
  });

  it('refuses a zip that is not a plugin before signing in or sending anything', async () => {
    await uploadPluginCommand(await writeZip('photos.zip', { 'photo.png': 'x' }), { api: platform.api });

    expect(said.err).toContain('plitzi pack plugin');
    expect(browser).not.toHaveBeenCalled();
    expect(platform.uploads).toHaveLength(0);
    expect(process.exitCode).toBe(1);
  });

  it('puts the choice of CDN to the person, not to whoever ran it, when the space has several', async () => {
    platform.cdns.push({ identifier: 'cdn-eu', name: 'Europe', domain: 'https://eu.example.com', provider: 'aws' });

    await uploadPluginCommand(await pluginZip(), { api: platform.api });

    expect(said.err).toContain('--cdn cdn-main | cdn-eu');
    expect(platform.uploads).toHaveLength(0);
    expect(process.exitCode).toBe(1);
  });

  it('uploads to the CDN named, and says which there are when it names none of them', async () => {
    platform.cdns.push({ identifier: 'cdn-eu', name: 'Europe', domain: 'https://eu.example.com', provider: 'aws' });
    const zip = await pluginZip();

    await uploadPluginCommand(zip, { api: platform.api, cdn: 'cdn-eu' });
    expect(platform.uploads[0].path).toContain('/cdns/cdn-eu/plugins');

    await uploadPluginCommand(zip, { api: platform.api, cdn: 'cdn-us' });
    expect(said.err).toContain('Its CDNs: cdn-main, cdn-eu');
    expect(platform.uploads).toHaveLength(1);
  });

  it('finds the zip plitzi pack plugin left in the project when none is named', async () => {
    await fs.writeFile(path.join(home, 'package.json'), '{"name":"site"}');
    await pluginZip('dist/plugins/seat-picker-1.2.0.zip');
    vi.spyOn(process, 'cwd').mockReturnValue(home);

    await uploadPluginCommand(undefined, { api: platform.api });

    expect(platform.uploads[0].path).toContain('filename=seat-picker-1.2.0.zip');
  });
});
