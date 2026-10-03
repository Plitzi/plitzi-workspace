import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isThisMachine, siteOwnership } from './siteOwnership';
import { writeConnection } from '../account/connection';
import { fakePlatform } from '../account/fakePlatform';

import type { FakePlatform } from '../account/fakePlatform';

let platform: FakePlatform;
let home: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-own-'));
  process.env.XDG_CONFIG_HOME = path.join(home, 'config');
  platform = await fakePlatform();
  platform.valid.add('live');
  await writeConnection({ api: platform.api, grant: { clientId: 'c', accessToken: 'live' } });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await platform.close();
  delete process.env.XDG_CONFIG_HOME;
  await fs.rm(home, { recursive: true, force: true });
});

describe('isThisMachine', () => {
  it('is localhost and whatever resolves only to a loopback address', async () => {
    expect(await isThisMachine('localhost')).toBe(true);
    expect(await isThisMachine('app.localhost')).toBe(true);
    expect(await isThisMachine('127.0.0.1')).toBe(true);
    expect(await isThisMachine('[::1]')).toBe(true);
    expect(await isThisMachine('nowhere.invalid')).toBe(false);
  });
});

describe('siteOwnership', () => {
  it('takes a site served from this machine without asking anybody', async () => {
    expect(await siteOwnership(new URL('http://127.0.0.1:4791/'), { api: platform.api })).toEqual({
      ok: true,
      said: 'served from this machine'
    });
  });

  it('takes a site a verified domain of one of the person’s spaces covers', async () => {
    expect(await siteOwnership(new URL('https://www.shop.example.com/pricing'), { api: platform.api })).toEqual({
      ok: true,
      said: 'shop.example.com, verified for Website'
    });
  });

  it('refuses any other site, saying how to show it is theirs', async () => {
    const answer = await siteOwnership(new URL('https://example.org/'), { api: platform.api });

    expect(answer.ok).toBe(false);
    expect('problem' in answer ? answer.problem : '').toContain('publish the `_plitzi` TXT record');
  });
});
