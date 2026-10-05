/* eslint-disable quotes -- the cases are source code, which reads best in the other quotes */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { doctor } from '.';
import create from '../commands/create';

import type { DoctorReport } from '.';

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

const run = async (options: { strict?: boolean } = {}): Promise<DoctorReport> => {
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

describe('plitzi doctor', () => {
  it('finds a project as plitzi create wrote it healthy', async () => {
    const report = await run({ strict: true });

    expect(codes(report)).toEqual([]);
    expect(report.ok).toBe(true);
    expect(process.exitCode).toBeUndefined();
    expect(report.areas.every(area => area.status === 'ok')).toBe(true);
  }, 30_000);

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
    expect(findingOf(report, 'plugin-entry-missing')).toMatchObject({ file: 'src/plugins/Legend/index.ts' });
    console.warn(
      JSON.stringify(
        report.findings.filter(f => f.area === 'plugins'),
        null,
        1
      )
    );
    expect(findingOf(report, 'plugin-does-not-build')?.message).toContain('./Bar');
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

  it('refuses a folder that is not a project plitzi create wrote', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(home);
    await fs.writeFile(path.join(home, 'package.json'), '{"name":"other"}');
    said = [];

    await doctor({});

    expect(said.join('\n')).toContain('this is not one');
    expect(process.exitCode).toBe(1);
  });
});
