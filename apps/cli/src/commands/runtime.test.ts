import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeConnection } from '../account/connection';
import { fakePlatform } from '../account/fakePlatform';

import type { FakePlatform } from '../account/fakePlatform';

/**
 * `plitzi runtime`: the project's runtime module packed with its own sdk-server and kept as the space's draft runtime,
 * and the variables it starts with — written, never read back.
 */

let platform: FakePlatform;
let home: string;
let project: string;
const said = { out: '', err: '' };

vi.mock('../account/oauth', async importOriginal => ({
  ...(await importOriginal<typeof import('../account/oauth')>()),
  openBrowser: () => undefined
}));

const { pushRuntime, runtimeStatus, setRuntimeVariable, unsetRuntimeVariable } = await import('./runtime');

/** The project's own sdk-server, as an install would put it: this workspace's. */
const installSdkServer = async () => {
  await fs.mkdir(path.join(project, 'node_modules', '@plitzi'), { recursive: true });
  await fs.symlink(
    path.resolve(import.meta.dirname, '../../../server'),
    path.join(project, 'node_modules', '@plitzi', 'sdk-server'),
    'dir'
  );
};

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-runtime-'));
  project = path.join(home, 'project');
  await fs.mkdir(path.join(project, 'src'), { recursive: true });
  await fs.writeFile(path.join(project, 'package.json'), '{"name":"board","type":"module"}');
  process.env.XDG_CONFIG_HOME = path.join(home, 'config');
  platform = await fakePlatform();
  platform.valid.add('live');
  await writeConnection({
    api: platform.api,
    grant: { clientId: 'c', accessToken: 'live' },
    space: { id: 3, name: 'Website', permanentUrl: 'website' }
  });
  vi.spyOn(process, 'cwd').mockReturnValue(project);
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

describe('plitzi runtime', () => {
  it('packs the module with the project’s own sdk-server, and keeps it as the draft runtime', async () => {
    await installSdkServer();
    await fs.writeFile(path.join(project, 'src', 'greeting.ts'), 'export const greet = (name: string) => name;\n');
    await fs.writeFile(
      path.join(project, 'src', 'runtime.ts'),
      'import { greet } from "./greeting";\nexport default { start: () => ({ said: greet("x") }) };\n'
    );

    await pushRuntime({ api: platform.api });

    expect(platform.runtime.pushed).toHaveLength(1);
    expect(platform.runtime.pushed[0]).toMatchObject({ contentType: 'application/octet-stream' });
    expect(said.out).toContain('draft runtime is dddddddddddd');
    expect(process.exitCode).toBeUndefined();
    // No TypeScript in this project to read the runtime's imports with: pushed all the same, its source not kept, why said.
    expect(platform.sources).toEqual([]);
    expect(said.out).toContain('Its source is not kept');
    expect(said.out).toContain('npm install -D typescript');
  });

  it('says where the module should be when there is none, and sends nothing', async () => {
    await pushRuntime({ api: platform.api });

    expect(said.err).toContain('There is no src/runtime.ts');
    expect(platform.runtime.pushed).toEqual([]);
  });

  it('sets and unsets a variable, and lists names — never values', async () => {
    await setRuntimeVariable('REDIS_URL', 'redis://secret@db:6379', { api: platform.api });
    await runtimeStatus({ api: platform.api });

    expect(platform.runtime.variables.get('REDIS_URL')).toBe('redis://secret@db:6379');
    expect(said.out).toContain('Variables: REDIS_URL');
    expect(said.out).not.toContain('secret@db');
    expect(said.out).toContain('main (draft, dddddddddddd): ready');

    await unsetRuntimeVariable('REDIS_URL', { api: platform.api });

    expect(platform.runtime.variables.has('REDIS_URL')).toBe(false);
  });
});
