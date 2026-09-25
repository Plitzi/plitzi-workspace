/* eslint-disable quotes */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import addPlugin from './addPlugin';
import createPlugin from './createPlugin';
import { coveredByWorkspace, findProject } from './existingProject';
import packPluginCommand from './packPlugin';
import { scaffold } from '../scaffold';

import type { CreateAnswers } from '../scaffold';

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

  it('holds several elements when asked, the one it is named after first', async () => {
    captureErrors();
    await inTemp(async dir => {
      const target = path.join(dir, 'seat-picker');
      await from(dir, () =>
        createPlugin(target, { install: false, packageManager: 'npm', elements: 'legend, price-tag' })
      );

      expect(await fs.readFile(path.join(target, 'src/elements.ts'), 'utf-8')).toContain(
        'export const elements = [SeatPicker, Legend, PriceTag];'
      );
      expect(await exists(path.join(target, 'src/PriceTag/Settings.tsx'))).toBe(true);
    });

    expect(process.exitCode).toBeUndefined();
  });

  it('refuses other elements that would share a type with it', async () => {
    const errors = captureErrors();
    await inTemp(dir =>
      from(dir, () =>
        createPlugin(path.join(dir, 'seat-picker'), { install: false, packageManager: 'npm', elements: 'seat-picker' })
      )
    );

    expect(process.exitCode).toBe(1);
    expect(errors()).toContain('would both be "seatPicker"');
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

/** A project exactly as `plitzi create` writes it, in `dir`. */
const cliProject = async (dir: string, over: Partial<CreateAnswers> = {}): Promise<void> => {
  const files = scaffold({
    name: 'site',
    mode: 'server',
    source: 'local',
    key: '',
    environment: 'main',
    packageManager: 'npm',
    ...over
  });
  await Promise.all(Object.entries(files).map(([file, contents]) => write(path.join(dir, file), contents)));
};

/** Everything the command printed on stdout, as one string. */
const captureOutput = () => {
  const lines: string[] = [];
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => lines.push(args.join(' ')));

  return () => lines.join('\n');
};

describe('plitzi add plugin', () => {
  it('needs a project to add to', async () => {
    const errors = captureErrors();
    await inTemp(dir => from(dir, () => addPlugin(['seat-picker'], {})));

    expect(process.exitCode).toBe(1);
    expect(errors()).toContain('plitzi create <folder> --plugin');
  });

  it('adds one after another to a project plitzi create wrote, which registers each by itself', async () => {
    captureErrors();
    const output = captureOutput();
    await inTemp(async dir => {
      await cliProject(dir);

      await from(dir, () => addPlugin(['seat-picker'], {}));
      await from(dir, () => addPlugin(['legend', 'price-tag'], {}));

      for (const folder of ['SeatPicker', 'Legend', 'PriceTag']) {
        for (const file of [`${folder}.tsx`, 'declaration.ts', 'Settings.tsx', 'index.ts']) {
          expect(await exists(path.join(dir, 'src/plugins', folder, file)), `${folder}/${file}`).toBe(true);
        }
      }
    });

    expect(process.exitCode).toBeUndefined();
    expect(output()).toContain('Registered: src/main.ts finds every folder of src/plugins.');
    expect(output()).toContain("custom({ id: 'legend', renderType: 'legend' })");
  });

  it('sends a project whose space lives in Plitzi to the builder to place it', async () => {
    captureErrors();
    const output = captureOutput();
    await inTemp(async dir => {
      await cliProject(dir, { source: 'cloud', key: 'k' });
      await from(dir, () => addPlugin(['seat-picker'], {}));
    });

    expect(output()).toContain('In the builder, add a Custom element with the render type "seatPicker"');
    expect(output()).not.toContain('src/space.ts');
  });

  it('tells a project from before plugins were found by folder the line its list needs', async () => {
    captureErrors();
    const output = captureOutput();
    await inTemp(async dir => {
      await cliProject(dir);
      await write(
        path.join(dir, 'src/main.ts'),
        "const plugins = { statCard: { js: path.resolve(PROJECT_ROOT, 'src/plugins/StatCard/index.ts'), action: 'compile' as const } };"
      );

      await from(dir, () => addPlugin(['seat-picker'], {}));

      expect(await exists(path.join(dir, 'src/plugins/SeatPicker/index.ts'))).toBe(true);
    });

    expect(output()).toContain("seatPicker: { js: path.resolve(PROJECT_ROOT, 'src/plugins/SeatPicker/index.ts')");
  });

  it('adds to a plugin package, and lists the element where the package publishes its elements', async () => {
    captureErrors();
    await inTemp(async dir => {
      const pkg = path.join(dir, 'seat-picker');
      await from(dir, () => createPlugin(pkg, { install: false, packageManager: 'npm' }));

      await from(pkg, () => addPlugin(['legend'], {}));

      expect(await exists(path.join(pkg, 'src/Legend/declaration.ts'))).toBe(true);
      expect(await fs.readFile(path.join(pkg, 'src/elements.ts'), 'utf-8')).toContain(
        'export const elements = [SeatPicker, Legend];'
      );
      expect(await fs.readFile(path.join(pkg, 'src/declarations.ts'), 'utf-8')).toContain(
        'export const declarations = [seatPicker, legend];'
      );
    });

    expect(process.exitCode).toBeUndefined();
  });

  it('leaves a package’s lists alone once somebody changed them, and says what to add', async () => {
    captureErrors();
    const output = captureOutput();
    await inTemp(async dir => {
      const pkg = path.join(dir, 'seat-picker');
      await from(dir, () => createPlugin(pkg, { install: false, packageManager: 'npm' }));
      const edited = `${await fs.readFile(path.join(pkg, 'src/elements.ts'), 'utf-8')}// mine\n`;
      await write(path.join(pkg, 'src/elements.ts'), edited);

      await from(pkg, () => addPlugin(['legend'], {}));

      expect(await fs.readFile(path.join(pkg, 'src/elements.ts'), 'utf-8')).toBe(edited);
    });

    expect(output()).toContain('are not the lists the CLI wrote');
  });

  it('asks where any other project keeps its components, and writes where it was told', async () => {
    const errors = captureErrors();
    await inTemp(async dir => {
      await write(path.join(dir, 'package.json'), JSON.stringify({ dependencies: { '@plitzi/plitzi-sdk': '^1' } }));

      await from(dir, () => addPlugin(['seat-picker'], {}));
      expect(errors()).toContain('--dir');
      expect(await exists(path.join(dir, 'src'))).toBe(false);

      process.exitCode = undefined;
      await from(dir, () => addPlugin(['seat-picker'], { dir: 'src/components' }));
      expect(await exists(path.join(dir, 'src/components/SeatPicker/index.ts'))).toBe(true);
    });

    expect(process.exitCode).toBeUndefined();
  });

  it('writes none of several when one of them has nowhere to go', async () => {
    captureErrors();
    await inTemp(async dir => {
      await cliProject(dir);
      await write(path.join(dir, 'src/plugins/Legend/notes.md'), 'mine');

      await from(dir, () => addPlugin(['seat-picker', 'legend'], {}));

      expect(await exists(path.join(dir, 'src/plugins/SeatPicker'))).toBe(false);
    });

    expect(process.exitCode).toBe(1);
  });

  it('refuses names that make the same element twice, a built-in one, or one --title cannot describe', async () => {
    const errors = captureErrors();
    await inTemp(async dir => {
      await cliProject(dir);

      await from(dir, () => addPlugin(['seat-picker', 'plitzi-plugin-seat-picker'], {}));
      await from(dir, () => addPlugin(['button'], {}));
      await from(dir, () => addPlugin(['legend', 'price-tag'], { title: 'Key' }));

      expect(await fs.readdir(path.join(dir, 'src/plugins'))).toEqual(['README.md', 'StatCard']);
    });

    expect(errors()).toContain('would both be "seatPicker"');
    expect(errors()).toContain('built-in element');
    expect(errors()).toContain('--title and --description describe one element');
  });
});

describe('plitzi pack plugin', () => {
  it('packs an element of a self-hosted project into the zip the builder takes', async () => {
    captureErrors();
    const output = captureOutput();
    await inTemp(async dir => {
      await cliProject(dir);
      await from(dir, () => addPlugin(['seat-picker'], {}));

      await from(dir, () => packPluginCommand(['src/plugins/SeatPicker'], {}));

      expect(await exists(path.join(dir, 'dist/plugins/seat-picker/plugin-manifest.json'))).toBe(true);
      expect(await exists(path.join(dir, 'dist/plugins/seat-picker-0.0.0.zip'))).toBe(true);
    });

    expect(process.exitCode).toBeUndefined();
    expect(output()).toContain('Upload it in the builder under Resources, as a plugin.');
  });

  it('asks which elements to pack instead of choosing, offering only the folders that are elements', async () => {
    const errors = captureErrors();
    captureOutput();
    await inTemp(async dir => {
      await cliProject(dir);
      await from(dir, () => addPlugin(['seat-picker'], {}));

      await from(dir, () => packPluginCommand([], {}));
    });

    expect(process.exitCode).toBe(1);
    expect(errors()).toContain('src/plugins/SeatPicker');
    // The scaffold's example has no declaration, so it is not an element the CLI can pack.
    expect(errors()).not.toContain('src/plugins/StatCard');
  });

  it('packs a plugin package as the package publishes itself, zip beside it', async () => {
    captureErrors();
    captureOutput();
    await inTemp(async dir => {
      const pkg = path.join(dir, 'seat-picker');
      await from(dir, () => createPlugin(pkg, { install: false, packageManager: 'npm', elements: 'legend' }));

      await from(pkg, () => packPluginCommand([], {}));

      const manifest = JSON.parse(await fs.readFile(path.join(pkg, 'dist/plugin-manifest.json'), 'utf-8')) as {
        pluginSchema: Record<string, unknown>;
      };
      expect(Object.keys(manifest.pluginSchema)).toEqual(['seatPicker', 'legend']);
      expect(await exists(path.join(pkg, 'seat-picker-0.1.0.zip'))).toBe(true);
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
