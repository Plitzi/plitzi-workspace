/* eslint-disable quotes -- the cases are source code, which reads best in the other quotes */
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { digestOf, readScaffoldRecord, writeScaffoldRecord } from './scaffoldRecord';
import { writeOrigin } from './spaceOrigin';
import { writeFiles } from './terminal';
import { upgrade } from './upgrade';
import { detectManagerVersion, machineryFiles, scaffold } from '../scaffold';
import { CLI_VERSION } from '../scaffold/project';

import type { UpgradeOptions } from './upgrade';
import type { CreateAnswers } from '../scaffold';

/** The version the CLI resolves `@plitzi/sdk-authoring` at, read as it reads it. */
const authoringVersion = (): string => {
  const manifest: unknown = JSON.parse(
    readFileSync(createRequire(import.meta.url).resolve('@plitzi/sdk-authoring/package.json'), 'utf-8')
  );

  return isRecord(manifest) && typeof manifest.version === 'string' ? manifest.version : '';
};

/** A list of the JSON answer, each entry read as an object. */
const recordsIn = (value: unknown): Record<string, unknown>[] => {
  const list: unknown[] = Array.isArray(value) ? value : [];

  return list.filter(isRecord);
};

const ANSWERS: CreateAnswers = {
  name: 'shop',
  mode: 'server',
  source: 'local',
  key: '',
  environment: 'main',
  packageManager: 'npm',
  managerVersion: '11.0.0'
};

describe('plitzi upgrade', () => {
  const cwd = process.cwd();
  let root = '';
  const file = (name: string) => path.join(root, name);
  const read = (name: string) => fs.readFile(file(name), 'utf-8');

  /** What it said, as `--json` says it — never installing, which a test has no network for. */
  const run = async (parts: string[], options: UpgradeOptions = {}): Promise<Record<string, unknown>> => {
    const said = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await upgrade(parts, { ...options, json: true, install: false });
    const printed: unknown = said.mock.calls.at(-1)?.[0];
    const parsed: unknown = JSON.parse(String(printed));
    said.mockRestore();

    return isRecord(parsed) ? parsed : {};
  };

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-upgrade-'));
    // A project as `create` writes it today, without the skills — those are the installed packages' to say.
    await writeFiles(
      root,
      Object.fromEntries(Object.entries(scaffold(ANSWERS)).filter(([name]) => !name.startsWith('.claude/')))
    );
    process.chdir(root);
  });

  afterEach(async () => {
    process.chdir(cwd);
    vi.restoreAllMocks();
    await fs.rm(root, { recursive: true, force: true });
  });

  it('replaces what the CLI wrote and nobody changed, adds what is missing, and only shows what is the project’s', async () => {
    const ours = machineryFiles(ANSWERS);
    // Written by an older CLI, untouched since: its digest is the one recorded.
    await fs.writeFile(file('plitzi/author.ts'), '// the author script of an older CLI\n');
    // The project's own: no record says the CLI wrote it so.
    await fs.writeFile(file('playwright.config.ts'), '// tuned by hand\n');
    await fs.rm(file('eslint.config.mjs'));
    await writeScaffoldRecord(root, '0.37.9', {
      files: { 'plitzi/author.ts': digestOf('// the author script of an older CLI\n') }
    });

    const shown = await run(['files']);
    const statuses = Object.fromEntries(
      recordsIn(shown.files).map((entry): [string, unknown] => [String(entry.file), entry.status])
    );
    expect(statuses).toMatchObject({
      'plitzi/author.ts': 'updated',
      'playwright.config.ts': 'yours',
      'eslint.config.mjs': 'added',
      'tsconfig.json': 'current'
    });
    // Shown is not written.
    expect(await read('plitzi/author.ts')).toBe('// the author script of an older CLI\n');

    await run(['files'], { write: true });

    expect(await read('plitzi/author.ts')).toBe(ours['plitzi/author.ts']);
    expect(await read('eslint.config.mjs')).toBe(ours['eslint.config.mjs']);
    expect(await read('playwright.config.ts')).toBe('// tuned by hand\n');
    const record = await readScaffoldRecord(root);
    expect(record?.cli).toBe(CLI_VERSION);
    expect(record?.files['plitzi/author.ts']).toBe(digestOf(ours['plitzi/author.ts']));
    expect(record?.files['playwright.config.ts']).toBeUndefined();

    await run(['files'], { write: true, take: ['playwright.config.ts'] });

    expect(await read('playwright.config.ts')).toBe(ours['playwright.config.ts']);
  });

  /**
   * The server an older CLI wrote into `main.ts` — three hundred lines that re-authored a saved space through
   * `tmp/space.json` — is today's `serveProject` call, and its author script hands the documents over IPC instead of
   * `--out`. Both are the CLI's: replaced whole, and nothing of the project's goes with them.
   */
  it('brings an older server and author script up to today’s, keeping every file of the project’s own', async () => {
    const ours = machineryFiles(ANSWERS);
    const olderMain = "const OFFLINE_DATA = path.join(PROJECT_ROOT, 'tmp/space.json');\n";
    const olderAuthor =
      "const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : undefined;\n";
    const ownOptions =
      "// SetByMain, as an older CLI typed it\nexport const serverOptions = { images: { domains: ['img.example.com'] } };\n";
    await fs.writeFile(file('src/main.ts'), olderMain);
    await fs.writeFile(file('plitzi/author.ts'), olderAuthor);
    await fs.writeFile(file('src/config/serverOptions.ts'), ownOptions);
    const space = await read('src/space/index.ts');
    const actions = await read('src/actions/index.ts');
    await writeScaffoldRecord(root, '0.38.5', {
      files: { 'src/main.ts': digestOf(olderMain), 'plitzi/author.ts': digestOf(olderAuthor) }
    });

    await run(['files'], { write: true });

    expect(await read('src/main.ts')).toBe(ours['src/main.ts']);
    expect(await read('src/main.ts')).toContain('await serveProject({');
    expect(await read('plitzi/author.ts')).toBe(ours['plitzi/author.ts']);
    expect(await read('plitzi/author.ts')).not.toContain('--out');
    expect(await read('src/config/serverOptions.ts')).toBe(ownOptions);
    expect(await read('src/space/index.ts')).toBe(space);
    expect(await read('src/actions/index.ts')).toBe(actions);
  });

  /**
   * A `main.ts` of today reads the project's server options and actions, which a project made before them never had: an
   * upgrade writes them for it — once, and never over the project's own.
   */
  it('writes the project’s own files the machinery reads, only when the project has none', async () => {
    await fs.rm(file('src/config/serverOptions.ts'));
    await fs.writeFile(file('src/actions/index.ts'), '// mine\n');

    const shown = await run(['files']);
    const statuses = Object.fromEntries(
      recordsIn(shown.files).map((entry): [string, unknown] => [String(entry.file), entry.status])
    );
    expect(statuses['src/config/serverOptions.ts']).toBe('seeded');
    expect(statuses).not.toHaveProperty('src/actions/index.ts');

    await run(['files'], { write: true });

    expect(await read('src/config/serverOptions.ts')).toBe(scaffold(ANSWERS)['src/config/serverOptions.ts']);
    expect(await read('src/actions/index.ts')).toBe('// mine\n');
    expect(
      (await readScaffoldRecord(root))?.files['src/config/serverOptions.ts'],
      'recorded as the CLI’s'
    ).toBeUndefined();
  });

  /** Beside a `main.ts` the project kept as its own, nothing reads them: they are written with the CLI's `main.ts`. */
  it('writes them only beside the CLI’s own file that reads them', async () => {
    await fs.rm(file('src/config/serverOptions.ts'));
    // Still a project the CLI knows — it finds its plugins in `src/plugins` — with a server of its own.
    await fs.writeFile(file('src/main.ts'), `// my own server, with its plugins from './plugins/'\n`);

    const shown = await run(['files'], { write: true });
    const named = recordsIn(shown.files).map(entry => entry.file);

    expect(named).not.toContain('src/config/serverOptions.ts');
    await expect(fs.access(file('src/config/serverOptions.ts'))).rejects.toThrow();

    await run(['files'], { write: true, take: ['src/main.ts'] });

    expect(await read('src/config/serverOptions.ts')).toBe(scaffold(ANSWERS)['src/config/serverOptions.ts']);
  });

  /**
   * A project made from a space has the `src/main.ts` the space gave it — its runtime, its built plugins — which `plitzi
   * pull` writes as the CLI it runs does. Offering `create`'s in its place would be offering to drop them.
   */
  it('leaves a file the space gave to `plitzi pull`, and says so', async () => {
    await fs.writeFile(file('src/main.ts'), '// the space’s server, with its runtime and plugins from ./plugins/\n');
    await writeOrigin(root, {
      format: 1,
      api: 'https://api.example.com',
      space: { id: 42, name: 'Pizarra', permanentUrl: 'pizarra' },
      source: 'local',
      version: { environment: 'main' },
      files: { 'src/main.ts': digestOf('// the space’s server, with its runtime and plugins from ./plugins/\n') },
      downloads: {},
      dependencies: {}
    });

    const shown = await run(['files'], { write: true, take: ['all'] });
    const statuses = Object.fromEntries(
      recordsIn(shown.files).map((entry): [string, unknown] => [String(entry.file), entry.status])
    );

    expect(statuses['src/main.ts']).toBe('space');
    expect(await read('src/main.ts')).toBe('// the space’s server, with its runtime and plugins from ./plugins/\n');
  });

  /**
   * A project written for Yarn and not installed yet has no lockfile to say so: what the CLI recorded writing it for
   * does, or every file quoting a command would be offered back as npm's — and replaced, being the CLI's untouched.
   */
  it('keeps the package manager the files were written for when no lockfile says one', async () => {
    // At the version this machine runs, which is what `.yarnrc.yml` is written for.
    const managerVersion = detectManagerVersion('yarn', root);
    const yarn: CreateAnswers = { ...ANSWERS, packageManager: 'yarn', ...(managerVersion ? { managerVersion } : {}) };
    const files = Object.fromEntries(Object.entries(scaffold(yarn)).filter(([name]) => !name.startsWith('.claude/')));
    await writeFiles(root, files);
    await writeScaffoldRecord(root, CLI_VERSION, {
      files: Object.fromEntries(Object.keys(machineryFiles(yarn)).map(name => [name, digestOf(files[name])])),
      packageManager: 'yarn'
    });

    const shown = await run(['files']);
    const changed = recordsIn(shown.files).filter(entry => entry.status !== 'current');

    expect(changed).toEqual([]);
  });

  it('never names the project’s own files — its space, pages and README', async () => {
    await fs.writeFile(file('src/space/index.ts'), '// mine\n');
    await fs.writeFile(file('README.md'), '# mine\n');

    const shown = await run(['files']);
    const named = recordsIn(shown.files).map(entry => entry.file);

    expect(named).not.toContain('src/space/index.ts');
    expect(named).not.toContain('README.md');
    expect(named).not.toContain('package.json');
  });

  it('merges package.json: what is missing added, @plitzi raised, a script of the project’s own left as it is', async () => {
    const manifest: unknown = JSON.parse(await read('package.json'));
    if (!isRecord(manifest) || !isRecord(manifest.scripts) || !isRecord(manifest.dependencies)) {
      throw new Error('the scaffold wrote no scripts');
    }

    const without = (entries: Record<string, unknown>, name: string) =>
      Object.fromEntries(Object.entries(entries).filter(([key]) => key !== name));
    const devDependencies = isRecord(manifest.devDependencies) ? without(manifest.devDependencies, '@plitzi/cli') : {};
    const scripts = { ...without(manifest.scripts, 'check'), lint: 'eslint src' };
    await fs.writeFile(
      file('package.json'),
      `${JSON.stringify(
        {
          ...manifest,
          scripts,
          dependencies: { ...manifest.dependencies, '@plitzi/plitzi-sdk': '^0.1.0', 'left-pad': '^1.3.0' },
          devDependencies
        },
        null,
        2
      )}\n`
    );

    const shown = await run(['packages'], { write: true });

    expect(shown.packages).toMatchObject({
      raised: [{ name: '@plitzi/plitzi-sdk', from: '^0.1.0', to: `^${CLI_VERSION}` }],
      added: [{ section: 'devDependencies', name: '@plitzi/cli' }],
      scripts: [{ name: 'check', command: 'plitzi check' }],
      ownScripts: [{ name: 'lint', yours: 'eslint src' }],
      install: 'needed'
    });
    const written: unknown = JSON.parse(await read('package.json'));
    expect(written).toMatchObject({
      scripts: { lint: 'eslint src', check: 'plitzi check' },
      dependencies: { '@plitzi/plitzi-sdk': `^${CLI_VERSION}`, 'left-pad': '^1.3.0' },
      devDependencies: { '@plitzi/cli': `^${CLI_VERSION}` }
    });
  });

  /**
   * A script the CLI wrote and nobody changed is the CLI's: it takes what the CLI writes today — `start:dev` watching
   * the files a project now has. One the project changed stays its own; and only the CLI's are recorded as such.
   */
  it('brings up the scripts the CLI wrote and nobody changed, and leaves a changed one to the project', async () => {
    const manifest: unknown = JSON.parse(await read('package.json'));
    if (!isRecord(manifest) || !isRecord(manifest.scripts)) {
      throw new Error('the scaffold wrote no scripts');
    }

    const older = {
      ...manifest.scripts,
      'start:dev': 'node --watch-path=./src/main.ts src/main.ts',
      lint: 'eslint src'
    };
    await fs.writeFile(file('package.json'), `${JSON.stringify({ ...manifest, scripts: older }, null, 2)}\n`);
    // An older CLI wrote `start:dev` as it is now; `lint` the project changed since.
    await writeScaffoldRecord(root, '0.38.4', {
      scripts: { ...(manifest.scripts as Record<string, string>), 'start:dev': older['start:dev'] }
    });

    const shown = await run(['packages'], { write: true });

    expect(shown.packages).toMatchObject({
      updatedScripts: [{ name: 'start:dev', from: older['start:dev'], to: manifest.scripts['start:dev'] }],
      ownScripts: [{ name: 'lint', yours: 'eslint src' }]
    });
    const written: unknown = JSON.parse(await read('package.json'));
    expect(written).toMatchObject({ scripts: { 'start:dev': manifest.scripts['start:dev'], lint: 'eslint src' } });
    const recorded = (await readScaffoldRecord(root))?.scripts;
    expect(recorded?.['start:dev']).toBe(manifest.scripts['start:dev']);
    expect(recorded, 'the project’s own script recorded as the CLI’s').not.toHaveProperty('lint');
  });

  it('brings every Plitzi skill to the installed version, whole, and leaves the project’s own skills alone', async () => {
    const skill = (name: string, inside: string) => file(path.join('.claude/skills', name, inside));
    await fs.mkdir(path.dirname(skill('plitzi-authoring', 'reference/gone.md')), { recursive: true });
    await fs.writeFile(skill('plitzi-authoring', 'SKILL.md'), '---\nname: plitzi-authoring\nversion: 0.1.0\n---\nOld.');
    await fs.writeFile(skill('plitzi-authoring', 'reference/gone.md'), 'A reference the skill no longer has.');
    await fs.mkdir(path.dirname(skill('ours', 'SKILL.md')), { recursive: true });
    await fs.writeFile(skill('ours', 'SKILL.md'), 'The project’s own.');

    const shown = await run(['skills'], { write: true });

    expect(shown.skills).toEqual(
      expect.arrayContaining([{ name: 'plitzi-authoring', was: '0.1.0', now: authoringVersion() }])
    );
    const updated = await fs.readFile(skill('plitzi-authoring', 'SKILL.md'), 'utf-8');
    expect(updated).toContain(`version: ${authoringVersion()}`);
    await expect(fs.readFile(skill('plitzi-authoring', 'reference/gone.md'), 'utf-8')).rejects.toThrow();
    expect(await fs.readFile(skill('ours', 'SKILL.md'), 'utf-8')).toBe('The project’s own.');
    // One the project never had is what `create` writes today: added.
    await expect(fs.readFile(skill('plitzi-cli', 'SKILL.md'), 'utf-8')).resolves.toContain('name: plitzi-cli');
  });

  it('finds a renamed name where it is written, and renames it — an import only where it is the package’s', async () => {
    await fs.mkdir(file('src/plugins/Ticker'), { recursive: true });
    await fs.mkdir(file('src/space'), { recursive: true });
    await fs.writeFile(
      file('src/plugins/Ticker/declaration.ts'),
      'export default { builder: { canTemplate: true } };\n'
    );
    await fs.writeFile(
      file('src/space/snippet.ts'),
      "import { authorTemplate } from '@plitzi/sdk-authoring';\n\nexport const hero = authorTemplate({});\n"
    );
    // A name of the project's own, which only happens to be spelled like the old export.
    await fs.writeFile(file('src/space/own.ts'), 'export type TemplateSpec = { id: string };\n');

    const shown = await run(['renames']);
    expect(shown.renames).toEqual([
      expect.objectContaining({
        file: path.join('src', 'plugins', 'Ticker', 'declaration.ts'),
        line: 1,
        name: 'canTemplate'
      }),
      expect.objectContaining({ file: path.join('src', 'space', 'snippet.ts'), line: 1, name: 'authorTemplate' }),
      expect.objectContaining({ file: path.join('src', 'space', 'snippet.ts'), line: 3, name: 'authorTemplate' })
    ]);

    await run(['renames'], { write: true });

    expect(await read('src/plugins/Ticker/declaration.ts')).toBe('export default { builder: { canSnippet: true } };\n');
    expect(await read('src/space/snippet.ts')).toContain('authorSnippet({})');
    expect(await read('src/space/own.ts')).toBe('export type TemplateSpec = { id: string };\n');
  });

  it('writes no file of a project laid out as an older CLI did, and says what moves it', async () => {
    await fs.rename(file('src/space/index.ts'), file('src/space.ts'));
    const main = await read('src/main.ts');
    const said = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await upgrade(['files'], { write: true });

    expect(String(said.mock.calls.at(0)?.[0])).toContain('doctor --fix');
    expect(await read('src/main.ts')).toBe(main);
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
  });

  it('refuses a part it does not know, naming the ones there are', async () => {
    const said = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await upgrade(['skils'], {});

    expect(String(said.mock.calls.at(0)?.[0])).toContain('files, packages, skills, renames');
    process.exitCode = undefined;
  });
});
