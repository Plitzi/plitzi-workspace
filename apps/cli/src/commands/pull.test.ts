/* eslint-disable quotes */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pull, verdictOf } from './pull';
import { readOrigin } from './spaceOrigin';
import { writeConnection } from '../account/connection';
import { fakePlatform } from '../account/fakePlatform';

import type { FakePlatform } from '../account/fakePlatform';

/** `plitzi pull`: a project made from a space, brought up to date with it without undoing what was done here. */

const { default: create } = await import('./create');

let platform: FakePlatform;
let home: string;
let project: string;

const read = (file: string): Promise<string> => fs.readFile(path.join(project, file), 'utf-8');

const write = async (file: string, text: string): Promise<void> => {
  await fs.mkdir(path.dirname(path.join(project, file)), { recursive: true });
  await fs.writeFile(path.join(project, file), text);
};

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-pull-'));
  process.env.XDG_CONFIG_HOME = path.join(home, 'config');
  platform = await fakePlatform();
  platform.valid.add('live');
  platform.pizarra.pages = {
    'index.ts': "import { homePage } from './pages/home.ts';\nexport const pizarra = { pages: [homePage] };\n",
    'pages/home.ts': "export const homePage = { name: 'Home' };\n",
    'pages/about.ts': "export const aboutPage = { name: 'About' };\n"
  };
  platform.functions = { files: { 'index.ts': 'export default {};\n' }, version: 'v1' };
  await writeConnection({ api: platform.api, grant: { clientId: 'c', accessToken: 'live' } });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  process.exitCode = undefined;

  project = path.join(home, 'board');
  await create(project, { source: 'local', packageManager: 'npm', install: false, api: platform.api, from: 'pizarra' });
  vi.spyOn(process, 'cwd').mockReturnValue(project);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await platform.close();
  delete process.env.XDG_CONFIG_HOME;
  process.exitCode = undefined;
  await fs.rm(home, { recursive: true, force: true });
});

describe('what a pull does to one file', () => {
  it('writes what changed on the space alone, keeps what changed here alone, and stops at what changed on both', () => {
    expect(verdictOf({ given: 'b', was: 'a', here: 'a' })).toBe('write');
    expect(verdictOf({ given: 'a', was: 'a', here: 'c' })).toBe('keep');
    expect(verdictOf({ given: 'b', was: 'a', here: 'c' })).toBe('conflict');
    expect(verdictOf({ given: 'b', was: 'a', here: 'b' })).toBe('same');
  });

  it('gives a new file, and takes back one the space dropped — unless it was changed here', () => {
    expect(verdictOf({ given: 'a' })).toBe('write');
    expect(verdictOf({ was: 'a', here: 'a' })).toBe('remove');
    expect(verdictOf({ was: 'a', here: 'c' })).toBe('keep');
    expect(verdictOf({ here: 'c' })).toBe('same');
  });

  it('leaves a file deleted here deleted, while the space leaves it be', () => {
    expect(verdictOf({ given: 'a', was: 'a' })).toBe('keep');
    expect(verdictOf({ given: 'b', was: 'a' })).toBe('conflict');
  });

  it('never claims a file of the project’s own the space now gives too', () => {
    expect(verdictOf({ given: 'a', here: 'c' })).toBe('conflict');
  });
});

describe('plitzi pull', () => {
  it('remembers where the project came from and what it was given', async () => {
    const origin = await readOrigin(project);

    expect(origin).toMatchObject({ api: platform.api, space: { id: 3, permanentUrl: 'pizarra' }, source: 'local' });
    expect(Object.keys(origin?.files ?? {})).toEqual(
      expect.arrayContaining(['src/space/pages/home.ts', 'src/main.ts', 'public/assets/world.json'])
    );
    expect(JSON.parse(await read('.plitzi/functions.json'))).toMatchObject({ space: 3, version: 'v1' });
  });

  it('brings what changed on the space, and keeps what changed here', async () => {
    platform.pizarra.pages['pages/home.ts'] = "export const homePage = { name: 'Home, again' };\n";
    delete platform.pizarra.pages['pages/about.ts'];
    platform.pizarra.pages['pages/blog.ts'] = "export const blogPage = { name: 'Blog' };\n";
    platform.pizarra.dependencies = { zod: '^4.0.0' };
    platform.functions = { files: { 'index.ts': 'export default { feed: {} };\n' }, version: 'v2' };
    await write('src/space/index.ts', '// mine\nexport const pizarra = {};\n');

    await pull({});

    expect(process.exitCode).toBeUndefined();
    expect(await read('src/space/pages/home.ts')).toContain('Home, again');
    expect(await read('src/space/pages/blog.ts')).toContain('Blog');
    await expect(read('src/space/pages/about.ts')).rejects.toThrow();
    expect(await read('src/space/index.ts')).toContain('// mine');
    expect(JSON.parse(await read('package.json'))).toMatchObject({ dependencies: { zod: '^4.0.0' } });
    expect(await read('functions/index.ts')).toContain('feed');
    expect(JSON.parse(await read('.plitzi/functions.json'))).toMatchObject({ version: 'v2' });
  });

  it('writes nothing when a file changed here and on the space — and takes the space’s with --force', async () => {
    platform.pizarra.pages['pages/home.ts'] = "export const homePage = { name: 'Theirs' };\n";
    platform.pizarra.pages['pages/about.ts'] = "export const aboutPage = { name: 'About, again' };\n";
    await write('src/space/pages/home.ts', "export const homePage = { name: 'Mine' };\n");

    await pull({});

    expect(process.exitCode).toBe(1);
    expect(await read('src/space/pages/home.ts')).toContain('Mine');
    expect(await read('src/space/pages/about.ts')).not.toContain('again');

    process.exitCode = undefined;
    await pull({ force: true });

    expect(process.exitCode).toBeUndefined();
    expect(await read('src/space/pages/home.ts')).toContain('Theirs');
    expect(await read('src/space/pages/about.ts')).toContain('again');
  });

  it('keeps a change here across pulls once it stood, as long as the space leaves the file be', async () => {
    await write('src/space/pages/home.ts', "export const homePage = { name: 'Mine' };\n");
    await pull({});
    platform.pizarra.pages['pages/about.ts'] = "export const aboutPage = { name: 'About, again' };\n";
    await pull({});

    expect(process.exitCode).toBeUndefined();
    expect(await read('src/space/pages/home.ts')).toContain('Mine');
    expect(await read('src/space/pages/about.ts')).toContain('again');
  });

  it('refuses a project no space made', async () => {
    await fs.rm(path.join(project, '.plitzi/space.json'));

    await pull({});

    expect(process.exitCode).toBe(1);
  });
});
