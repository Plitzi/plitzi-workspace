import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeConnection } from '../account/connection';
import { fakePlatform } from '../account/fakePlatform';

import type { FakePlatform } from '../account/fakePlatform';

/**
 * `plitzi functions`: `functions/` as a working copy of the space's source — pulled, pushed against the version it was
 * pulled at, and never silently overwriting either side.
 */

let platform: FakePlatform;
let home: string;
let project: string;
const said = { out: '', err: '' };

vi.mock('../account/oauth', async importOriginal => ({
  ...(await importOriginal<typeof import('../account/oauth')>()),
  openBrowser: () => undefined
}));

const { devFunction, pullFunctions, pushFunctions, tryFunction } = await import('./functions');

const write = async (file: string, text: string) => {
  await fs.mkdir(path.dirname(path.join(project, 'functions', file)), { recursive: true });
  await fs.writeFile(path.join(project, 'functions', file), text);
};

const read = (file: string) => fs.readFile(path.join(project, 'functions', file), 'utf8');

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-functions-'));
  project = path.join(home, 'project');
  await fs.mkdir(project, { recursive: true });
  await fs.writeFile(path.join(project, 'package.json'), '{"name":"site"}');
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

describe('plitzi functions', () => {
  it('pulls the space’s files into functions/, and pushes them back against that version', async () => {
    platform.functions = {
      files: { 'index.ts': 'export default {};', 'lib/feed.ts': 'export const a = 1;' },
      version: 'v4'
    };

    await pullFunctions({ api: platform.api });
    await write('lib/feed.ts', 'export const a = 2;');
    await pushFunctions({ api: platform.api });

    expect(await read('lib/feed.ts')).toBe('export const a = 2;');
    expect(platform.functions).toEqual({
      files: { 'index.ts': 'export default {};', 'lib/feed.ts': 'export const a = 2;' },
      version: 'v5'
    });
    expect(said.out).toContain('feed.read');
    expect(process.exitCode).toBeUndefined();
  });

  it('refuses to pull over what is not pushed, unless told to', async () => {
    platform.functions = { files: { 'index.ts': 'export default {};' }, version: 'v1' };
    await pullFunctions({ api: platform.api });
    await write('index.ts', 'export default { mine: true };');

    await pullFunctions({ api: platform.api });

    expect(said.err).toContain('not pushed yet: index.ts');
    expect(await read('index.ts')).toBe('export default { mine: true };');

    await pullFunctions({ api: platform.api, force: true });

    expect(await read('index.ts')).toBe('export default {};');
  });

  it('refuses a push when the space moved on since the pull', async () => {
    platform.functions = { files: { 'index.ts': 'export default {};' }, version: 'v1' };
    await pullFunctions({ api: platform.api });
    platform.functions = { files: { 'index.ts': 'export default { builder: true };' }, version: 'v2' };
    await write('index.ts', 'export default { mine: true };');

    await pushFunctions({ api: platform.api });

    expect(said.err).toContain('changed since your pull');
    expect(platform.functions.version).toBe('v2');
    expect(process.exitCode).toBe(1);
  });

  it('prints where the code is wrong', async () => {
    await write('index.ts', 'export default {\nBROKEN');

    await pushFunctions({ api: platform.api });

    expect(said.err).toContain('functions/index.ts:2 Expected ";"');
    expect(process.exitCode).toBe(1);
  });

  it('tries a task with its params, and shows what it logged', async () => {
    await tryFunction('feed.read', { api: platform.api, params: '{"limit":3}' });

    expect(platform.tried).toEqual([{ task: 'feed.read', params: { limit: 3 } }]);
    expect(said.out).toContain('log  reading');
    expect(said.out).toContain('"limit": 3');
  });
});

describe('plitzi functions dev', () => {
  /** The project's own sdk-server, as an install would put it: this workspace's, which `dev` then resolves from there. */
  const installSdkServer = async () => {
    await fs.mkdir(path.join(project, 'node_modules', '@plitzi'), { recursive: true });
    await fs.symlink(
      path.resolve(import.meta.dirname, '../../../server'),
      path.join(project, 'node_modules', '@plitzi', 'sdk-server'),
      'dir'
    );
  };

  it('runs a task from functions/ in an isolate, with nothing sent to the space', async () => {
    await installSdkServer();
    await write(
      'index.ts',
      'import { greet } from "./greet";\nexport default { tasks: [{ namespace: "hello", action: "greet", title: "Greet", params: {}, run: async ({ name }, ctx) => { ctx.log("hi"); return greet(name); } }] };'
    );
    await write('greet.ts', 'export const greet = (name: string) => `Hello, ${name}`;');

    await devFunction('hello.greet', { params: '{"name":"Ada"}' });

    expect(said.out).toContain('log  hi');
    expect(said.out).toContain('"Hello, Ada"');
    expect(platform.tried).toEqual([]);
    expect(process.exitCode).toBeUndefined();
  });

  it('says what to install when the project has no sdk-server', async () => {
    await write('index.ts', 'export default {};');

    await devFunction('hello.greet', {});

    expect(said.err).toContain('npm install --save-dev @plitzi/sdk-server isolated-vm core-js');
    expect(process.exitCode).toBe(1);
  });
});
