/* eslint-disable quotes -- the cases are source code, which reads best in the other quotes */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { doctor } from '.';
import create from '../commands/create';
import { digestOf, readScaffoldRecord, writeScaffoldRecord } from '../commands/scaffoldRecord';

import type { DoctorOptions, DoctorReport } from '.';

/**
 * `plitzi doctor` on a project `plitzi create` wrote, then changed the ways a developer changes one: each change that
 * stops it from installing, starting, building or pushing is found, where it is, with what fixes it — and a
 * project as it was written is found healthy.
 */

let home = '';
let project = '';
let said: string[] = [];

const write = async (file: string, text: string): Promise<void> => {
  await fs.mkdir(path.dirname(path.join(project, file)), { recursive: true });
  await fs.writeFile(path.join(project, file), text);
};

const read = (file: string): Promise<string> => fs.readFile(path.join(project, file), 'utf-8');

const manifest = async (): Promise<Record<string, unknown>> => {
  const parsed: unknown = JSON.parse(await read('package.json'));

  return isRecord(parsed) ? parsed : {};
};

const ranges = (value: unknown): Record<string, string> =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      )
    : {};

/** A package as an install leaves it: its manifest, at the version given, and the modules given beside it. */
const installed = async (name: string, version: string, modules: Record<string, string> = {}): Promise<void> => {
  const dir = path.join(project, 'node_modules', name);
  const exports = Object.fromEntries(
    Object.keys(modules).map(subpath => [subpath, `./${subpath.slice(2) || 'index'}.js`])
  );
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({ name, version, type: 'module', ...(Object.keys(exports).length > 0 ? { exports } : {}) })
  );
  for (const [subpath, code] of Object.entries(modules)) {
    await fs.writeFile(path.join(dir, `${subpath.slice(2) || 'index'}.js`), code);
  }
};

/**
 * Everything `package.json` declares, installed at the version its range starts at: the SDK's authoring as this
 * workspace builds it (the space imports it), and a server whose rules are the ones the checks ask it for.
 */
const install = async (): Promise<void> => {
  const { dependencies, devDependencies } = await manifest();
  for (const [name, range] of Object.entries({ ...ranges(devDependencies), ...ranges(dependencies) })) {
    const version = /\d+\.\d+\.\d+/.exec(range)?.[0] ?? '1.0.0';
    if (name === '@plitzi/sdk-authoring') {
      await fs.mkdir(path.join(project, 'node_modules', '@plitzi'), { recursive: true });
      await fs.symlink(
        path.resolve(import.meta.dirname, '../../../../packages/sdk-authoring'),
        path.join(project, 'node_modules', name),
        'dir'
      );
    } else if (name === '@plitzi/sdk-server') {
      await installed(name, version, {
        './actions': 'export const MIN_SIGNING_SECRET_LENGTH = 32;\n',
        './functions-runner':
          'export const buildFunctions = async source => {\n' +
          "  const at = Object.keys(source).find(file => source[file].includes('node:'));\n" +
          "  if (at) { throw Object.assign(new Error('refused'), { problems: [{ file: at, line: 1, message: 'node: cannot be imported' }] }); }\n" +
          "  return { code: '', bytes: 0 };\n};\n"
      });
    } else {
      await installed(name, version);
    }
  }
};

const run = async (options: Omit<DoctorOptions, 'json'> = {}): Promise<DoctorReport> => {
  said = [];
  process.exitCode = undefined;
  await doctor({ json: true, ...options });
  const parsed: unknown = JSON.parse(said.at(-1) ?? '{}');

  // The report is the doctor's own JSON, written just above: its shape is `DoctorReport`.
  return parsed as DoctorReport;
};

const codes = (report: DoctorReport): string[] =>
  report.findings.filter(finding => finding.severity !== 'info').map(finding => finding.code);

const findingOf = (report: DoctorReport, code: string) => report.findings.find(finding => finding.code === code);

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-doctor-'));
  vi.spyOn(console, 'log').mockImplementation((line: unknown) => said.push(String(line)));
  vi.spyOn(console, 'error').mockImplementation((line: unknown) => said.push(String(line)));
  await create(path.join(home, 'site'), { mode: 'server', source: 'local', packageManager: 'npm', install: false });
  project = path.join(home, 'site');
  vi.spyOn(process, 'cwd').mockReturnValue(project);
  await install();
  await write('.env', `PLITZI_SIGNING_SECRET=${'a'.repeat(64)}\n`);
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
  await fs.rm(home, { recursive: true, force: true });
});

// Each run is the whole doctor on a project on disk, some of them twice: far over the default 5 s on a machine running
// every package's tests at once.
describe('plitzi doctor', { timeout: 30_000 }, () => {
  it('finds a project as plitzi create wrote it healthy', async () => {
    const report = await run({ strict: true });

    expect(codes(report)).toEqual([]);
    expect(report.ok).toBe(true);
    expect(process.exitCode).toBeUndefined();
    expect(report.areas.every(area => area.status === 'ok')).toBe(true);
  });

  it('says what Node would refuse to run, which the typecheck lets through', async () => {
    const main = await read('src/main.ts');
    await write('src/main.ts', main.replace("'./config/serverOptions.ts'", "'./config/serverOptions'"));
    await write('src/space/stock.ts', "import stock from '../data/stock.json';\nexport default stock;\n");
    await write('src/data/stock.json', '[]');
    await write('src/space/index.ts', `import './stock.ts';\nimport 'left-pad';\n${await read('src/space/index.ts')}`);

    const report = await run();

    expect(findingOf(report, 'import-unresolved')).toMatchObject({
      file: 'src/main.ts',
      fix: 'Import "./config/serverOptions.ts".'
    });
    expect(findingOf(report, 'json-without-attribute')).toMatchObject({ file: 'src/space/stock.ts' });
    expect(findingOf(report, 'undeclared-dependency')).toMatchObject({ file: 'src/space/index.ts' });
    expect(report.ok).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  it('says what an entry the server loads by name does not export', async () => {
    await write('src/runtime/index.ts', 'export const start = () => ({});\n');

    const report = await run();

    expect(findingOf(report, 'export-missing')).toMatchObject({ file: 'src/runtime/index.ts' });
  });

  it('holds each plugin to its folder: an entry, a declaration of the same type, one folder a type', async () => {
    await write('src/plugins/StatCard/declaration.ts', "export default { type: 'statsCard' };\n");
    await write('src/plugins/Legend/declaration.ts', "export default { type: 'legend' };\n");
    await write('src/plugins/Chart/index.ts', "import Bar from './Bar';\nexport default Bar;\n");

    const report = await run();

    expect(findingOf(report, 'plugin-type-mismatch')).toMatchObject({ file: 'src/plugins/StatCard/declaration.ts' });
    expect(findingOf(report, 'plugin-entry-missing')).toMatchObject({ area: 'layout', file: 'src/plugins/Legend/' });
    expect(findingOf(report, 'plugin-does-not-build')?.message).toContain('./Bar');
  });

  /**
   * What the server and `npm run author` refuse to start with, and what works and should not stay — said as they say
   * it (`checkProjectLayout`), with the rest of the project still checked; `--fix` makes each fix with one reading.
   */
  it('says what is out of place, each with its fix, and --fix makes the ones that have one reading', async () => {
    await write('src/plugin/Chart/index.ts', 'export default () => null;\n');
    await write('src/plugin/Chart/declaration.ts', "export default { type: 'chart' };\n");
    await write('src/plugins/Badge/index.js', 'export default () => null;\n');
    await write('src/plugins/Badge/declaration.ts', "export default { type: 'badge' };\n");
    await write('src/plugins/story-editor/index.ts', 'export default () => null;\n');
    await write('src/data/notes.txt', 'a note\n');
    await fs.rename(path.join(project, '.env'), path.join(project, 'src/.env'));
    await fs.rm(path.join(project, '.env.example'));

    const report = await run();

    expect(
      report.findings
        .filter(finding => finding.area === 'layout')
        .map(({ severity, code, file, repair }) => ({ severity, code, file, repair }))
    ).toEqual([
      {
        severity: 'error',
        code: 'entry-not-typescript',
        file: 'src/plugins/Badge/index.js',
        repair:
          'moves src/plugins/Badge/index.js → src/plugins/Badge/index.ts — every import and script naming it follows'
      },
      { severity: 'error', code: 'plugin-name-invalid', file: 'src/plugins/story-editor/', repair: undefined },
      {
        severity: 'error',
        code: 'folder-misplaced',
        file: 'src/plugin/',
        repair: 'moves src/plugin/ → src/plugins/ — every import and script naming it follows'
      },
      {
        severity: 'error',
        code: 'env-in-src',
        file: 'src/.env',
        repair: 'moves src/.env → .env'
      },
      { severity: 'warning', code: 'env-example-missing', file: '.env.example', repair: undefined },
      { severity: 'warning', code: 'data-not-json', file: 'src/data/notes.txt', repair: undefined }
    ]);
    // One problem among the rest: the other areas are still read.
    expect(report.areas.find(area => area.area === 'plugins')?.status).not.toBe('skipped');
    expect(findingOf(report, 'plugin-name-invalid')?.fix).toContain(
      'git mv src/plugins/story-editor src/plugins/StoryEditor'
    );
    expect(report.recommendations).toContainEqual({ command: 'plitzi doctor --fix', fixes: 3 });

    const fixed = await run({ fix: true });

    expect(fixed.repaired.repairs).toEqual([
      'moves src/plugins/Badge/index.js → src/plugins/Badge/index.ts — every import and script naming it follows',
      'moves src/plugin/ → src/plugins/ — every import and script naming it follows',
      'moves src/.env → .env',
      // Read again once `.env` is at the root: its example has one reading now.
      'writes .env.example'
    ]);
    expect(await read('src/plugins/Chart/index.ts')).toBe('export default () => null;\n');
    await expect(fs.access(path.join(project, 'src/plugin'))).rejects.toThrow();
    expect(await read('src/plugins/Badge/index.ts')).toBe('export default () => null;\n');
    expect(await read('.env')).toMatch(/^PLITZI_SIGNING_SECRET=a{64}$/m);
    expect(await read('.env.example')).toBe('PLITZI_SIGNING_SECRET=\n');
    expect(fixed.findings.filter(finding => finding.area === 'layout').map(finding => finding.code)).toEqual([
      'plugin-name-invalid',
      'data-not-json'
    ]);
  });

  // `src/Data/` is `src/data/` to a macOS disk and not to Linux: renamed through a name of its own, the file kept.
  it('renames a folder that differs only in case, keeping what it holds', async () => {
    await fs.rm(path.join(project, 'src/data'), { recursive: true });
    await write('src/Data/stock.json', '{ "items": [] }\n');

    expect(findingOf(await run(), 'folder-near-miss')).toMatchObject({
      severity: 'warning',
      file: 'src/Data/',
      repair: 'moves src/Data/ → src/data/ — every import and script naming it follows'
    });

    await run({ fix: true });

    expect(await fs.readdir(path.join(project, 'src'))).toContain('data');
    expect(await fs.readdir(path.join(project, 'src'))).not.toContain('Data');
    expect(await read('src/data/stock.json')).toBe('{ "items": [] }\n');
  });

  it('says data that is not JSON, which a push would be refused', async () => {
    await write('src/data/broken.json', '{ "a": ');

    const report = await run();

    expect(findingOf(report, 'data-invalid-json')).toMatchObject({ file: 'src/data/broken.json' });
  });

  it('builds the functions with the project’s own server, and says where they fail', async () => {
    await write('src/functions/index.ts', "import fs from 'node:fs';\nexport default { fs };\n");

    const report = await run();

    expect(findingOf(report, 'functions-do-not-build')).toMatchObject({
      file: 'src/functions/index.ts:1',
      message: 'node: cannot be imported'
    });
  });

  it('says the configs and settings that would leak a secret or stop the server', async () => {
    await write('.gitignore', 'node_modules\n');
    await write('.env', 'PLITZI_SIGNING_SECRET=short\n');
    const tsconfig: unknown = JSON.parse(await read('tsconfig.json'));
    await write(
      'tsconfig.json',
      `// comments are allowed\n${JSON.stringify({ ...(isRecord(tsconfig) ? tsconfig : {}), include: ['plitzi'] }, null, 2)}`
    );

    const report = await run();

    expect(findingOf(report, 'env-not-ignored')?.severity).toBe('error');
    expect(findingOf(report, 'signing-secret-short')?.message).toContain('32');
    expect(findingOf(report, 'tsconfig-src-left-out')?.severity).toBe('error');
  });

  it('says a secret committed to git', async () => {
    try {
      execFileSync('git', ['init', '-q'], { cwd: project });
      execFileSync('git', ['add', '-f', '.env'], { cwd: project });
    } catch {
      // No git on this machine: nothing to test it against.
      return;
    }

    const report = await run();

    expect(findingOf(report, 'env-committed')).toMatchObject({ severity: 'error', file: '.env' });
  });

  it('says what package.json lost, and what is installed twice', async () => {
    const changed = await manifest();
    const scripts = isRecord(changed.scripts) ? { ...changed.scripts } : {};
    delete scripts.start;
    delete changed.type;
    await write('package.json', JSON.stringify({ ...changed, scripts }, null, 2));
    await installed('@plitzi/plitzi-sdk/node_modules/react', '18.0.0');

    const report = await run();

    expect(findingOf(report, 'not-esm')?.severity).toBe('error');
    expect(findingOf(report, 'script-missing')).toMatchObject({
      severity: 'error',
      message: expect.stringContaining('start') as unknown
    });
    expect(findingOf(report, 'duplicate-copy')?.message).toContain('react');
  });

  it('says a script that starts Node on a file, or watches a folder, that is not there', async () => {
    await fs.rm(path.join(project, 'src/functions'), { recursive: true });
    const changed = await manifest();
    const scripts = isRecord(changed.scripts) ? { ...changed.scripts, author: 'node plitzi/authoring.ts' } : {};
    await write('package.json', JSON.stringify({ ...changed, scripts }, null, 2));

    const report = await run();

    expect(findingOf(report, 'watch-path-missing')?.message).toContain('./src/functions');
    expect(findingOf(report, 'script-target-missing')?.message).toContain('plitzi/authoring.ts');
  });

  /** No file of the project reads `.env`: Node does, when the script that starts it says so. */
  it('says a script that runs the server’s code without reading .env', async () => {
    const changed = await manifest();
    const scripts = isRecord(changed.scripts) ? { ...changed.scripts, start: 'node src/main.ts' } : {};
    await write('package.json', JSON.stringify({ ...changed, scripts }, null, 2));

    const report = await run();

    expect(report.findings.filter(finding => finding.code === 'script-env-unread')).toEqual([
      expect.objectContaining({
        severity: 'warning',
        file: 'package.json',
        message: expect.stringContaining('The script start runs Node without reading .env') as unknown
      })
    ]);
  });

  /** Node's watcher, handed `--env-file`, watches the project's root: every write in it is a restart. */
  it('says a watched script reading .env with Node’s flag, which restarts on every write', async () => {
    const changed = await manifest();
    const scripts = isRecord(changed.scripts)
      ? { ...changed.scripts, 'start:dev': 'node --env-file-if-exists=.env --watch-path=./src/main.ts src/main.ts' }
      : {};
    await write('package.json', JSON.stringify({ ...changed, scripts }, null, 2));

    const report = await run();

    expect(findingOf(report, 'script-env-watched')).toMatchObject({
      severity: 'warning',
      fix: expect.stringContaining('node --import @plitzi/sdk-server/env') as unknown
    });
    expect(findingOf(report, 'script-env-unread')).toBeUndefined();
  });

  /** `src/env.ts` read `.env` before Node did: an older CLI's, and nothing reads it beside today's `main.ts`. */
  it('says machinery the CLI no longer writes, left over — and whether upgrade removes it or it is the project’s', async () => {
    const older = "try {\n  process.loadEnvFile(new URL('../.env', import.meta.url));\n} catch {\n  // None.\n}\n";
    await write('src/env.ts', older);
    const record = await readScaffoldRecord(project);
    await writeScaffoldRecord(project, record?.cli ?? '0.38.4', {
      files: { ...record?.files, 'src/env.ts': digestOf(older) }
    });

    expect(findingOf(await run(), 'machinery-retired')).toMatchObject({
      severity: 'warning',
      file: 'src/env.ts',
      fix: 'plitzi upgrade files --write'
    });

    await write('src/env.ts', `${older}// mine\n`);
    const report = await run();
    expect(findingOf(report, 'machinery-retired')).toBeUndefined();
    expect(findingOf(report, 'machinery-retired-yours')).toMatchObject({ severity: 'info', file: 'src/env.ts' });
  });

  it('says the CLI’s files that are gone or behind, and the records it cannot read', async () => {
    await fs.rm(path.join(project, 'plitzi/author.ts'));
    await write('.plitzi/scaffold.json', '{ "format": 2 }');

    const report = await run();

    expect(findingOf(report, 'machinery-missing')).toMatchObject({ severity: 'error', file: 'plitzi/author.ts' });
    expect(findingOf(report, 'record-unreadable')).toMatchObject({ file: '.plitzi/scaffold.json' });
  });

  it('fails on warnings only with --strict', async () => {
    await write('src/data/notes.txt', 'not data');

    expect((await run()).ok).toBe(true);
    expect(process.exitCode).toBeUndefined();
    expect((await run({ strict: true })).ok).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  /**
   * The project as a 0.38.4 CLI laid it out: the space in `src/space.ts` and its parts in `src/site/`, `author` in
   * `src/`, its cache at the root.
   */
  const olderLayout = async (): Promise<void> => {
    const parts = (await fs.readdir(path.join(project, 'src/space'))).filter(file => file !== 'index.ts');
    await fs.mkdir(path.join(project, 'src/site'));
    for (const part of parts) {
      await fs.rename(path.join(project, 'src/space', part), path.join(project, 'src/site', part));
    }

    await fs.rename(path.join(project, 'src/space/index.ts'), path.join(project, 'src/space.ts'));
    await fs.rmdir(path.join(project, 'src/space'));
    await write('src/space.ts', (await read('src/space.ts')).replaceAll("from './", "from './site/"));
    await fs.rename(path.join(project, 'plitzi/author.ts'), path.join(project, 'src/author.ts'));
    const changed = await manifest();
    const scripts = isRecord(changed.scripts)
      ? { ...changed.scripts, author: 'node --env-file-if-exists=.env src/author.ts' }
      : {};
    await write('package.json', JSON.stringify({ ...changed, scripts }, null, 2));
    await write('.sdk-plugins/statCard@1.0.0/index.js', '');
    // Recorded as that CLI wrote them, where it wrote them.
    const record = await readScaffoldRecord(project);
    const files = new Map(Object.entries(record?.files ?? {}));
    files.delete('plitzi/author.ts');
    files.set('src/author.ts', digestOf(await read('src/author.ts')));
    files.set('src/main.ts', digestOf(await read('src/main.ts')));
    await writeScaffoldRecord(project, record?.cli ?? '0.38.4', {
      files: Object.fromEntries(files),
      scripts: { ...record?.scripts, author: 'node --env-file-if-exists=.env src/author.ts' }
    });
  };

  it('says a layout an older CLI left, and checks nothing else against it', async () => {
    await olderLayout();

    const report = await run();

    expect(report.findings.filter(finding => finding.code === 'older-layout').map(finding => finding.file)).toEqual([
      'src/space.ts',
      'src/site/',
      'src/author.ts'
    ]);
    expect(findingOf(report, 'older-leftover')).toMatchObject({
      file: '.sdk-plugins/',
      repair: 'deletes .sdk-plugins/'
    });
    expect(report.areas.filter(area => area.status === 'skipped').map(area => area.area)).toContain('packages');
    // Taken for a project whose space is on Plitzi, it would have been told to set a key it does not need.
    expect(codes(report)).not.toContain('key-missing');
    expect(report.recommendations[0]).toEqual({ command: 'plitzi doctor --fix', fixes: 4 });
  });

  it('says with --fix --dry-run what it would repair, and changes nothing', async () => {
    await olderLayout();

    const report = await run({ fix: true, dryRun: true });

    expect(report.repaired.done).toBe(false);
    expect(report.repaired.repairs[0]).toContain('src/space.ts → src/space/index.ts');
    expect(await read('src/space.ts')).toContain("from './site/tokens.ts'");
  });

  it('moves an older layout with --fix — every import and script following — and the project is whole again', async () => {
    await olderLayout();
    await write('.gitignore', 'node_modules\n');

    const report = await run({ fix: true });

    expect(report.ok).toBe(true);
    expect(codes(report)).toEqual([]);
    expect(await read('src/space/index.ts')).toContain("from './tokens.ts'");
    expect(await read('plitzi/author.ts')).toContain('await projectSpace()');
    expect(await manifest()).toHaveProperty(['scripts', 'author'], 'node --env-file-if-exists=.env plitzi/author.ts');
    await expect(fs.access(path.join(project, '.sdk-plugins'))).rejects.toThrow();
    expect(await read('.gitignore')).toContain('.env');
    expect(report.repaired.repairs).toEqual(
      expect.arrayContaining([expect.stringContaining('moves src/space.ts'), 'deletes .sdk-plugins/'])
    );
    // The CLI's files moved are still the CLI's: upgrade brings them up to date rather than leaving them as the project's.
    expect(
      report.findings.filter(finding => finding.code === 'machinery-yours').map(finding => finding.file)
    ).not.toEqual(expect.arrayContaining(['src/main.ts']));
    expect(
      report.findings.filter(finding => finding.code === 'machinery-yours').map(finding => finding.file)
    ).not.toEqual(expect.arrayContaining(['plitzi/author.ts']));
  });

  /**
   * An older `src/main.ts` wrote the space to `tmp/space.json` on every save and read it back; today's is handed the
   * documents over IPC. Left behind, the file is said — and deleted only once nothing names it.
   */
  it('says the space an older server wrote to tmp/, and deletes it once no main.ts reads it', async () => {
    const today = await read('src/main.ts');
    await write('tmp/space.json', '{}');
    await write('src/main.ts', "const OFFLINE_DATA = path.join(PROJECT_ROOT, 'tmp/space.json');\n");

    const older = findingOf(await run(), 'older-leftover');

    expect(older).toMatchObject({ file: 'tmp/space.json' });
    expect(older?.fix).toContain('src/main.ts still imports it');
    expect(older).not.toHaveProperty('repair');

    await write('src/main.ts', today);
    const report = await run({ fix: true });

    expect(report.repaired.repairs).toContain('deletes tmp/space.json');
    await expect(fs.access(path.join(project, 'tmp/space.json'))).rejects.toThrow();
  });

  it('writes a signing secret with --fix where there is none', async () => {
    await write('.env', '# PORT=8080\n');

    const report = await run({ fix: true });

    expect(report.repaired.repairs).toContain('writes a new PLITZI_SIGNING_SECRET to .env');
    expect(await read('.env')).toMatch(/^PLITZI_SIGNING_SECRET=[0-9a-f]{64}$/m);
    expect(findingOf(report, 'signing-secret-missing')).toBeUndefined();
  });

  it('refuses a folder that is not a project plitzi create wrote', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(home);
    await fs.writeFile(path.join(home, 'package.json'), '{"name":"other"}');
    said = [];

    await doctor({});

    expect(said.join('\n')).toContain('this is not one');
    expect(process.exitCode).toBe(1);
  });
});
