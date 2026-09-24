/* eslint-disable quotes */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import addPlugin from './addPlugin';
import createPlugin from './createPlugin';
import { coveredByWorkspace, findProject } from './existingProject';

/**
 * The two ways an element of one's own comes into being — a package of its own, or a folder of a project — run as an
 * agent runs them: with nobody at the terminal. What is asserted is where the files land, that a choice nobody made is
 * never made for them, and that a project's own arrangements are read rather than overwritten.
 */

const inTemp = async (run: (dir: string) => Promise<void>): Promise<void> => {
  const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-cli-plugin-')));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};

/** Runs `run` from `dir`, as if the command were typed there. */
const from = async (dir: string, run: () => Promise<void>): Promise<void> => {
  const cwd = vi.spyOn(process, 'cwd').mockReturnValue(dir);
  try {
    await run();
  } finally {
    cwd.mockRestore();
  }
};

const write = async (file: string, contents: string): Promise<void> => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, contents);
};

const exists = (file: string): Promise<boolean> =>
  fs.access(file).then(
    () => true,
    () => false
  );

/** Everything the command said on stderr, as one string. */
const captureErrors = () => {
  const lines: string[] = [];
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => lines.push(args.join(' ')));
  vi.spyOn(console, 'log').mockImplementation(() => undefined);

  return () => lines.join('\n');
};

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe('plitzi create --plugin', () => {
  it('asks the person for the name and the folder instead of choosing them, when nobody is at the terminal', async () => {
    const errors = captureErrors();
    await inTemp(dir => from(dir, () => createPlugin(undefined, { install: false, packageManager: 'npm' })));

    expect(process.exitCode).toBe(1);
    expect(errors()).toContain('--name');
    expect(errors()).toContain('<directory>');
    expect(errors()).toContain('If you are an AI agent');
  });

  it('refuses a name that makes no element, before writing anything', async () => {
    const errors = captureErrors();
    await inTemp(async dir => {
      await from(dir, () => createPlugin(path.join(dir, 'Seat Picker'), { install: false, packageManager: 'npm' }));

      expect(await fs.readdir(dir)).toEqual([]);
    });

    expect(process.exitCode).toBe(1);
    expect(errors()).toContain('not a package name npm accepts');
  });

  it('writes a whole package from its folder name, with its own install settings when it stands alone', async () => {
    captureErrors();
    await inTemp(async dir => {
      const target = path.join(dir, 'plitzi-plugin-seat-picker');
      await from(dir, () => createPlugin(target, { install: false, packageManager: 'yarn', title: 'Seats' }));

      const pkg = JSON.parse(await fs.readFile(path.join(target, 'package.json'), 'utf-8')) as { name: string };
      expect(pkg.name).toBe('plitzi-plugin-seat-picker');
      expect(await fs.readFile(path.join(target, 'src/SeatPicker/declaration.ts'), 'utf-8')).toContain(
        "label: 'Seats'"
      );
      expect(await exists(path.join(target, '.yarnrc.yml'))).toBe(true);
    });

    expect(process.exitCode).toBeUndefined();
  });

  it('inside a workspace, installs with its manager and leaves how to install to it', async () => {
    captureErrors();
    await inTemp(async dir => {
      await write(path.join(dir, 'package.json'), JSON.stringify({ name: 'mono', workspaces: ['packages/*'] }));
      await write(path.join(dir, 'yarn.lock'), '');
      const target = path.join(dir, 'packages/seat-picker');

      await from(dir, () => createPlugin(target, { install: false }));

      expect(await exists(path.join(target, 'package.json'))).toBe(true);
      expect(await exists(path.join(target, '.yarnrc.yml'))).toBe(false);
      expect(await fs.readFile(path.join(target, 'README.md'), 'utf-8')).toContain('yarn start');
    });

    expect(process.exitCode).toBeUndefined();
  });

  it('never writes over a folder with work in it', async () => {
    const errors = captureErrors();
    await inTemp(async dir => {
      await write(path.join(dir, 'seat-picker/notes.md'), 'mine');
      await from(dir, () => createPlugin(path.join(dir, 'seat-picker'), { install: false, packageManager: 'npm' }));

      expect(await fs.readdir(path.join(dir, 'seat-picker'))).toEqual(['notes.md']);
    });

    expect(errors()).toContain('is not empty');
  });
});

describe('plitzi add plugin', () => {
  it('needs a project to add to', async () => {
    const errors = captureErrors();
    await inTemp(dir => from(dir, () => addPlugin('seat-picker', {})));

    expect(process.exitCode).toBe(1);
    expect(errors()).toContain('plitzi create <folder> --plugin');
  });

  it('puts it in src/plugins of a project plitzi create wrote, which registers it by itself', async () => {
    captureErrors();
    await inTemp(async dir => {
      await write(
        path.join(dir, 'package.json'),
        JSON.stringify({ dependencies: { '@plitzi/plitzi-sdk': '^1', '@plitzi/sdk-server': '^1' } })
      );
      await write(path.join(dir, 'src/main.ts'), 'readdirSync(PLUGINS_DIR, { withFileTypes: true })');

      await from(dir, () => addPlugin('seat-picker', {}));

      for (const file of ['SeatPicker.tsx', 'declaration.ts', 'Settings.tsx', 'index.ts']) {
        expect(await exists(path.join(dir, 'src/plugins/SeatPicker', file)), file).toBe(true);
      }
    });

    expect(process.exitCode).toBeUndefined();
  });

  it('asks where any other project keeps its components, and writes where it was told', async () => {
    const errors = captureErrors();
    await inTemp(async dir => {
      await write(path.join(dir, 'package.json'), JSON.stringify({ dependencies: { '@plitzi/plitzi-sdk': '^1' } }));

      await from(dir, () => addPlugin('seat-picker', {}));
      expect(errors()).toContain('--dir');
      expect(await exists(path.join(dir, 'src'))).toBe(false);

      process.exitCode = undefined;
      await from(dir, () => addPlugin('seat-picker', { dir: 'src/components' }));
      expect(await exists(path.join(dir, 'src/components/SeatPicker/index.ts'))).toBe(true);
    });

    expect(process.exitCode).toBeUndefined();
  });
});

describe('the project something is added to', () => {
  it('is read for its manager, its workspace folders, and whether plitzi create wrote it', async () => {
    await inTemp(async dir => {
      await write(path.join(dir, 'package.json'), JSON.stringify({ name: 'mono' }));
      await write(path.join(dir, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n  - 'plugins/*'\n");
      await write(path.join(dir, 'pnpm-lock.yaml'), '');
      await write(path.join(dir, 'apps/site/package.json'), JSON.stringify({ name: 'site' }));

      const project = await findProject(path.join(dir, 'apps/site'));

      expect(project).toMatchObject({
        root: path.join(dir, 'apps/site'),
        packageManager: 'pnpm',
        workspaceRoot: dir,
        workspaceFolders: ['apps', 'plugins']
      });
      expect(project?.plitzi).toBeUndefined();
      expect(project && coveredByWorkspace(project, path.join(dir, 'plugins/seat-picker'))).toBe(true);
      expect(project && coveredByWorkspace(project, path.join(dir, 'tools/seat-picker'))).toBe(false);
    });
  });
});
