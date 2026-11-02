import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, vi } from 'vitest';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { doctor } from '..';
import create from '../../commands/project/create';
import { WORKSPACE_ROOT } from '../../tests/roots';

import type { DoctorOptions, DoctorReport } from '..';

/**
 * A project `plitzi create` wrote, installed as the doctor reads one, for `plitzi doctor`'s tests: `doctorProjectEachTest()`
 * makes a new one before each test, and the helpers write, read and examine it. The test file mocks the browser.
 */

export let home = '';
export let project = '';
export let said: string[] = [];

export const write = async (file: string, text: string): Promise<void> => {
  await fs.mkdir(path.dirname(path.join(project, file)), { recursive: true });
  await fs.writeFile(path.join(project, file), text);
};

/** The project the helpers and the doctor work on from now on: `dir`, the folder the doctor is run in. */
export const examine = (dir: string): void => {
  project = dir;
  vi.spyOn(process, 'cwd').mockReturnValue(dir);
};

export const read = (file: string): Promise<string> => fs.readFile(path.join(project, file), 'utf-8');

export const manifest = async (): Promise<Record<string, unknown>> => {
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
export const installed = async (name: string, version: string, modules: Record<string, string> = {}): Promise<void> => {
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
export const install = async (): Promise<void> => {
  const { dependencies, devDependencies } = await manifest();
  for (const [name, range] of Object.entries({ ...ranges(devDependencies), ...ranges(dependencies) })) {
    const version = /\d+\.\d+\.\d+/.exec(range)?.[0] ?? '1.0.0';
    if (name === '@plitzi/sdk-authoring') {
      await fs.mkdir(path.join(project, 'node_modules', '@plitzi'), { recursive: true });
      await fs.symlink(
        path.join(WORKSPACE_ROOT, 'packages/sdk-authoring'),
        path.join(project, 'node_modules', name),
        'dir'
      );
    } else if (name === '@plitzi/sdk-server') {
      await installed(name, version, {
        './actions': 'export const MIN_SIGNING_SECRET_LENGTH = 32;\n',
        './project': 'export const serveProject = () => undefined;\n',
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

export const run = async (options: Omit<DoctorOptions, 'json'> = {}): Promise<DoctorReport> => {
  said = [];
  process.exitCode = undefined;
  await doctor({ json: true, ...options });
  const parsed: unknown = JSON.parse(said.at(-1) ?? '{}');

  // The report is the doctor's own JSON, written just above: its shape is `DoctorReport`.
  return parsed as DoctorReport;
};

export const codes = (report: DoctorReport): string[] =>
  report.findings.filter(finding => finding.severity !== 'info').map(finding => finding.code);

export const findingOf = (report: DoctorReport, code: string) => report.findings.find(finding => finding.code === code);

/** A project made before each test of the file and removed after it, examined on a Node with its security release. */
export const doctorProjectEachTest = (): void => {
  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-doctor-'));
    vi.spyOn(console, 'log').mockImplementation((line: unknown) => said.push(String(line)));
    vi.spyOn(console, 'error').mockImplementation((line: unknown) => said.push(String(line)));
    await create(path.join(home, 'site'), { mode: 'server', source: 'local', packageManager: 'npm', install: false });
    examine(path.join(home, 'site'));
    await install();
    await write('.env', `PLITZI_SIGNING_SECRET=${'a'.repeat(64)}\n`);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
    await fs.rm(home, { recursive: true, force: true });
  });

  // Run as on a Node with its security release, whatever this machine runs: the machine's Node is no finding of the
  // project's here — `nodeFindings` is held to each version on its own.
  const machine = process.versions.node;
  beforeEach(() => {
    Object.defineProperty(process.versions, 'node', { value: '24.22.1', configurable: true });
  });
  afterEach(() => {
    Object.defineProperty(process.versions, 'node', { value: machine, configurable: true });
  });
};
