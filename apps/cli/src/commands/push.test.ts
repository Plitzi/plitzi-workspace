/* eslint-disable quotes -- the cases are source code, which reads best in the other quotes */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readOrigin, writeOrigin } from './spaceOrigin';
import { writeConnection } from '../account/connection';
import { fakePlatform } from '../account/fakePlatform';

import type { Check } from './askChecks';
import type { FakePlatform } from '../account/fakePlatform';

/**
 * `plitzi push`: a project put back on its space as the draft — the way back of `plitzi pull` — never over what the
 * builder did since unseen, and only the parts asked for.
 */

const askChecks = vi.fn<(question: string, options: readonly Check<unknown>[]) => Promise<unknown[] | undefined>>();

vi.mock('./askChecks', () => ({ askChecks }));

const { default: create } = await import('./create');
const { push } = await import('./push');

let platform: FakePlatform;
let home: string;
let project: string;

/** A page, as authoring code a project runs without installing anything: the declaration as a literal. */
const space = (title: string): string =>
  `export const pizarra = { name: 'Pizarra', permanentUrl: 'pizarra', pages: [{ name: '${title}', slug: '', isDefault: true, body: [] }] };\n`;

/** The space's index as a person edits it: the page changed, the name the project imports it by kept. */
const edited = (title: string): string => `${space(title)}export { pizarra as space };\n`;

const read = (file: string): Promise<string> => fs.readFile(path.join(project, file), 'utf-8');

const write = async (file: string, text: string): Promise<void> => {
  await fs.mkdir(path.dirname(path.join(project, file)), { recursive: true });
  await fs.writeFile(path.join(project, file), text);
};

/** Runs `run` as if a person were at the terminal: vitest's streams are not TTYs. */
const atTerminal = async (run: () => Promise<void>): Promise<void> => {
  const stdin = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
  const stdout = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
  Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
  Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
  try {
    await run();
  } finally {
    const restore = (stream: NodeJS.ReadStream | NodeJS.WriteStream, descriptor?: PropertyDescriptor) => {
      if (descriptor) {
        Object.defineProperty(stream, 'isTTY', descriptor);
      } else {
        Reflect.deleteProperty(stream, 'isTTY');
      }
    };
    restore(process.stdin, stdin);
    restore(process.stdout, stdout);
  }
};

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-push-'));
  process.env.XDG_CONFIG_HOME = path.join(home, 'config');
  platform = await fakePlatform();
  platform.valid.add('live');
  platform.pizarra.pages = { 'index.ts': space('Home') };
  platform.functions = { files: { 'index.ts': 'export default {};\n' }, version: 'v1' };
  await writeConnection({
    api: platform.api,
    grant: { clientId: 'c', accessToken: 'live' },
    space: { id: 3, name: 'Pizarra', permanentUrl: 'pizarra' }
  });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  process.exitCode = undefined;
  askChecks.mockReset();

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

describe('plitzi push', () => {
  it('puts the space back as the draft it came from, and remembers the draft it made', async () => {
    expect((await readOrigin(project))?.draft).toBe('draft-1');
    await write('src/space/index.ts', edited('Welcome'));

    await push(['space'], {});

    expect(process.exitCode).toBeUndefined();
    expect(platform.pizarra.imports).toHaveLength(1);
    const [sent] = platform.pizarra.imports;
    expect(sent).toMatchObject({ format: 1, base: 'draft-1', force: false, actions: [] });
    expect('connectors' in sent).toBe(false);
    expect(JSON.stringify(sent.documents.schema)).toContain('Welcome');
    expect((await readOrigin(project))?.draft).toBe('draft-2');
  });

  /**
   * `create --from` wrote the space's CDN addresses as the project's paths, which Plitzi does not serve: they go back as
   * the addresses they were — and what would not reach Plitzi at all is said before anything is sent.
   */
  it('sends the space’s files back as their CDN addresses, and says what Plitzi would not have', async () => {
    const world = `${platform.api}/files/pizarra/assets/world.json`;
    const said: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((line: unknown) => said.push(String(line)));
    await write(
      'src/space/index.ts',
      "export const pizarra = { name: 'Pizarra', permanentUrl: 'pizarra', pages: [{ name: 'Home', slug: '', isDefault: true, body: [" +
        "{ type: 'apiContainer', id: 'world', attributes: { query: '/assets/world.json' } }," +
        "{ type: 'apiContainer', id: 'stock', runtime: 'server', attributes: { query: '/data/stock.json' } }," +
        "{ type: 'image', id: 'logo', attributes: { src: '/logo.png' } }" +
        '] }] };\nexport { pizarra as space };\n'
    );
    await write('public/logo.png', 'png');

    await push(['space'], {});

    const sent = JSON.stringify(platform.pizarra.imports.at(-1));
    expect(sent).toContain(`"query":"${world}"`);
    expect(sent).not.toContain('"query":"/assets/world.json"');
    expect(said.join('\n')).toContain('stock reads /data/stock.json');
    expect(said.join('\n')).toContain('public/logo.png');
  });

  it('refuses a draft edited since the project had it, and replaces it with --force', async () => {
    platform.pizarra.draft = 'draft-from-the-builder';

    await push(['space'], {});

    expect(process.exitCode).toBe(1);
    expect(platform.pizarra.imports).toHaveLength(0);
    expect(vi.mocked(console.error).mock.calls.flat().join('\n')).toContain('changed since this project last had it');

    process.exitCode = undefined;
    await push(['space'], { force: true });

    expect(process.exitCode).toBeUndefined();
    expect(platform.pizarra.imports).toMatchObject([{ base: 'draft-1', force: true }]);
  });

  it('sends only what changed when nobody is there to choose — and in the order that names come before their names', async () => {
    await write('src/functions/index.ts', 'export default { feed: {} };\n');

    await push([], {});

    expect(process.exitCode).toBeUndefined();
    expect(platform.functions.version).toBe('v2');
    expect(platform.pizarra.imports).toHaveLength(0);

    await write('src/space/index.ts', edited('Welcome'));
    await push([], {});

    expect(platform.functions.version).toBe('v2');
    expect(platform.pizarra.imports).toHaveLength(1);
  });

  it('asks at a terminal, with what changed ticked, and sends what is ticked', async () => {
    await write('src/functions/index.ts', 'export default { feed: {} };\n');
    askChecks.mockImplementation((_question, options) =>
      Promise.resolve(options.filter(option => option.label.startsWith('space')).map(({ value }) => value))
    );

    await atTerminal(() => push([], {}));

    const [question, options] = askChecks.mock.calls[0];
    expect(question).toContain('Pizarra');
    expect(options.map(({ label, checked }) => [label.split(' ')[0], checked])).toEqual([
      ['space', false],
      ['functions', true]
    ]);
    expect(platform.pizarra.imports).toHaveLength(1);
    expect(platform.functions.version).toBe('v1');
  });

  it('sends nothing when the list is given up', async () => {
    askChecks.mockResolvedValue(undefined);

    await atTerminal(() => push([], {}));

    expect(platform.pizarra.imports).toHaveLength(0);
    expect(process.exitCode).toBeUndefined();
  });

  it('records only what it sent: a change the builder made elsewhere is still the next pull’s', async () => {
    const before = (await readOrigin(project))?.files['src/functions/index.ts'];
    platform.functions = { files: { 'index.ts': 'export default { theirs: {} };\n' }, version: 'v2' };
    await write('src/space/index.ts', edited('Welcome'));

    await push(['space'], {});

    expect((await readOrigin(project))?.files['src/functions/index.ts']).toBe(before);
  });

  it('names what it cannot send, before sending anything', async () => {
    await push(['pages'], {});

    expect(process.exitCode).toBe(1);
    expect(vi.mocked(console.error).mock.calls.flat().join('\n')).toContain(
      'plitzi push sends space, functions, runtime, plugins — not pages'
    );

    process.exitCode = undefined;
    await push(['runtime'], {});

    expect(process.exitCode).toBe(1);
    expect(vi.mocked(console.error).mock.calls.flat().join('\n')).toContain('This project has no runtime to push');
    expect(platform.pizarra.imports).toHaveLength(0);
  });

  it('writes only the draft: a project following a published environment follows the draft first', async () => {
    const origin = await readOrigin(project);
    if (!origin) {
      throw new Error('create --from records where the project came from');
    }

    await writeOrigin(project, { ...origin, version: { environment: 'production', revision: 2 } });

    await push(['space'], {});

    expect(process.exitCode).toBe(1);
    expect(vi.mocked(console.error).mock.calls.flat().join('\n')).toContain('plitzi pull --environment main');
  });

  it('pushes to the space the project came from, and to no other', async () => {
    const origin = await readOrigin(project);
    if (!origin) {
      throw new Error('create --from records where the project came from');
    }

    await writeOrigin(project, { ...origin, space: { id: 8, name: 'Another', permanentUrl: 'another' } });

    await push(['space'], {});

    expect(process.exitCode).toBe(1);
    expect(vi.mocked(console.error).mock.calls.flat().join('\n')).toContain('This project is Another’s');
    expect(platform.pizarra.imports).toHaveLength(0);
  });

  it('puts a project that never had the space on it only while the space holds nobody’s work — then pull follows it', async () => {
    await fs.rm(path.join(project, '.plitzi'), { recursive: true });

    await push(['space'], {});

    expect(process.exitCode).toBe(1);
    expect(vi.mocked(console.error).mock.calls.flat().join('\n')).toContain('plitzi create --from pizarra');

    process.exitCode = undefined;
    platform.pizarra.worked = false;
    await push(['space'], {});

    expect(process.exitCode).toBeUndefined();
    expect(platform.pizarra.imports).toMatchObject([{ base: null, force: false }]);
    expect(await readOrigin(project)).toMatchObject({
      space: { id: 3 },
      draft: 'draft-2',
      version: { environment: 'main' }
    });
    expect(await read('src/space/index.ts')).toContain('Home');
  });
});
