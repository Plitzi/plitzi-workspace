import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeConnection } from '../account/connection';
import { fakePlatform } from '../account/fakePlatform';

import type { FakePlatform } from '../account/fakePlatform';

/** `plitzi create --from`: a space on Plitzi, as a project that serves it alone (docs/en/projects-from-spaces.md). */

let platform: FakePlatform;
let home: string;

const { default: create } = await import('./create');

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-from-'));
  process.env.XDG_CONFIG_HOME = path.join(home, 'config');
  platform = await fakePlatform();
  platform.valid.add('live');
  await writeConnection({ api: platform.api, grant: { clientId: 'c', accessToken: 'live' } });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  process.exitCode = undefined;
});

afterEach(async () => {
  vi.restoreAllMocks();
  await platform.close();
  delete process.env.XDG_CONFIG_HOME;
  process.exitCode = undefined;
  await fs.rm(home, { recursive: true, force: true });
});

const options = { source: 'local', packageManager: 'npm', install: false, api: '' };

describe('plitzi create --from', () => {
  it('writes the space as a project, and serves its files from the project instead of the CDN', async () => {
    const target = path.join(home, 'board');

    await create(target, { ...options, api: platform.api, from: 'pizarra' });

    expect(process.exitCode).toBeUndefined();
    const index = await fs.readFile(path.join(target, 'src/space/index.ts'), 'utf-8');
    expect(index.startsWith('export const pizarra = {};\n')).toBe(true);
    expect(index).toContain('export { pizarra as space };');
    expect(await fs.readFile(path.join(target, 'src/space/index.ts'), 'utf-8')).toContain('pizarra as space');
    expect(JSON.parse(await fs.readFile(path.join(target, 'public/assets/world.json'), 'utf-8'))).toEqual({ land: [] });
    await expect(fs.access(path.join(target, 'src/plugins/StatCard/index.ts'))).rejects.toThrow();
    expect(await fs.readFile(path.join(target, '.env'), 'utf-8')).toMatch(/PLITZI_SIGNING_SECRET=[0-9a-f]{64}/);
  });

  it('writes nothing for a space the person may not change', async () => {
    const target = path.join(home, 'locked');

    await create(target, { ...options, api: platform.api, from: 'locked' });

    expect(process.exitCode).toBe(1);
    await expect(fs.access(target)).rejects.toThrow();
  });

  it('refuses to make it a browser-only project: a space taken out runs its own server', async () => {
    await create(path.join(home, 'client'), { ...options, mode: 'client', api: platform.api, from: 'pizarra' });

    expect(process.exitCode).toBe(1);
  });

  it('refuses a revision of the draft before asking for anything', async () => {
    const target = path.join(home, 'draft-revision');

    await create(target, { ...options, api: platform.api, from: 'pizarra', revision: '3' });

    expect(process.exitCode).toBe(1);
    await expect(fs.access(target)).rejects.toThrow();
  });
});
