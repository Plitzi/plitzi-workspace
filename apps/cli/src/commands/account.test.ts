import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { whoami } from './account';
import { writeConnection } from '../account/connection';
import { fakePlatform } from '../account/fakePlatform';

import type { FakePlatform } from '../account/fakePlatform';

let platform: FakePlatform;
let home: string;
const said = { out: '', err: '' };

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-account-'));
  process.env.XDG_CONFIG_HOME = path.join(home, 'config');
  platform = await fakePlatform();
  platform.valid.add('live');
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
  await platform.close();
  delete process.env.XDG_CONFIG_HOME;
  process.exitCode = undefined;
  await fs.rm(home, { recursive: true, force: true });
});

describe('plitzi whoami', () => {
  it('says who and which space as one JSON object with --json, never the session’s tokens', async () => {
    await writeConnection({
      api: platform.api,
      grant: { clientId: 'c', accessToken: 'live' },
      space: { id: 3, name: 'Website', permanentUrl: 'website' }
    });
    await whoami({ api: platform.api, json: true });

    expect(JSON.parse(said.out)).toEqual({
      api: platform.api,
      user: 'ada@example.com',
      space: { id: 3, name: 'Website', permanentUrl: 'website' }
    });
    expect(said.out).not.toContain('live');
  });

  it('fails on stderr, with nothing on stdout, when nobody is signed in', async () => {
    await whoami({ api: platform.api, json: true });

    expect(said.out).toBe('');
    expect(said.err).toContain('Not signed in');
    expect(process.exitCode).toBe(1);
  });
});
