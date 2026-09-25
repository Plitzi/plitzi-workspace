/* eslint-disable quotes */
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { PackError, packPlugin } from './pack';
import { writeFiles } from '../commands/terminal';
import { pluginNames, scaffoldElement, scaffoldPlugin } from '../scaffold';

/**
 * A plugin is packed for a page that is not this one: the page provides React and the SDK, imports the code from a
 * blob URL, and learns what it holds from the manifest before loading anything. What is asserted is that contract —
 * built for real, with esbuild, into a folder of its own.
 */

const inTemp = async (run: (dir: string) => Promise<void>): Promise<void> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-pack-'));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};

/** An element as `plitzi add plugin` writes it, in its folder under `src/plugins`. */
const element = (dir: string, name: string, title: string) =>
  writeFiles(
    path.join(dir, 'src/plugins', pluginNames(name).component),
    scaffoldElement(name, { title, description: '', owner: 'Acme' })
  );

type Manifest = {
  root: string;
  version: string;
  author: string;
  definition: { name: string; verified: boolean };
  pluginSchema: Record<string, { definition: { type: string } }>;
  assets: Record<string, { src: string; type: string; integrity: string; isMain: boolean }>;
};

const readManifest = async (dir: string): Promise<Manifest> =>
  JSON.parse(await fs.readFile(path.join(dir, 'plugin-manifest.json'), 'utf-8')) as Manifest;

describe('packing element folders', () => {
  it('builds one module the page imports its React and SDK into, and a manifest of every element', async () => {
    await inTemp(async dir => {
      await element(dir, 'seat-picker', 'Seats');
      await element(dir, 'legend', 'Key');
      const outDir = path.join(dir, 'dist/plugins/seat-picker');

      const result = await packPlugin({
        root: dir,
        source: {
          kind: 'elements',
          folders: [path.join(dir, 'src/plugins/SeatPicker'), path.join(dir, 'src/plugins/Legend')]
        },
        base: 'seat-picker',
        version: '1.2.0',
        outDir
      });

      expect(result).toMatchObject({ root: 'seatPicker', types: ['seatPicker', 'legend'] });
      expect(await fs.readdir(outDir)).toEqual(['plugin-manifest.json', 'seat-picker.mjs']);

      const code = await fs.readFile(path.join(outDir, 'seat-picker.mjs'), 'utf-8');
      expect(code).toMatch(/from"react"/);
      expect(code).toMatch(/from"@plitzi\/plitzi-sdk"/);
      expect(code).toMatch(/export\{[^}]*as default[^}]*\}/);
      expect(code).toMatch(/as plugins/);

      const manifest = await readManifest(outDir);
      expect(manifest).toMatchObject({ root: 'seatPicker', version: '1.2.0', author: 'Acme' });
      expect(manifest.definition).toMatchObject({ name: 'Seats', verified: false });
      expect(Object.keys(manifest.pluginSchema)).toEqual(['seatPicker', 'legend']);
      const hash = createHash('sha384').update(code).digest('base64');
      expect(manifest.assets['seat-picker.mjs']).toEqual({
        src: 'seat-picker.mjs',
        type: 'script',
        integrity: `sha384-${hash}`,
        isMain: true
      });
    });
  });

  it('zips the build with every file at its root, as the builder unpacks it', async () => {
    await inTemp(async dir => {
      await element(dir, 'seat-picker', 'Seats');
      const zip = path.join(dir, 'dist/plugins/seat-picker-1.0.0.zip');

      await packPlugin({
        root: dir,
        source: { kind: 'elements', folders: [path.join(dir, 'src/plugins/SeatPicker')] },
        base: 'seat-picker',
        version: '1.0.0',
        outDir: path.join(dir, 'dist/plugins/seat-picker'),
        zip
      });

      expect(Object.keys(unzipSync(await fs.readFile(zip))).sort()).toEqual([
        'plugin-manifest.json',
        'seat-picker.mjs'
      ]);
    });
  });

  it('publishes the stylesheet an element imports, and keeps its images inside the one file', async () => {
    await inTemp(async dir => {
      await element(dir, 'seat-picker', 'Seats');
      const folder = path.join(dir, 'src/plugins/SeatPicker');
      await fs.writeFile(path.join(folder, 'seat.css'), '.seat { color: currentColor; }\n');
      await fs.writeFile(path.join(folder, 'seat.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
      const component = path.join(folder, 'SeatPicker.tsx');
      await fs.writeFile(
        component,
        `import './seat.css';\nimport seat from './seat.svg';\n(globalThis as Record<string, unknown>).seatIcon = seat;\n${await fs.readFile(component, 'utf-8')}`
      );
      const outDir = path.join(dir, 'dist/plugins/seat-picker');

      await packPlugin({
        root: dir,
        source: { kind: 'elements', folders: [folder] },
        base: 'seat-picker',
        version: '1.0.0',
        outDir
      });

      expect((await fs.readdir(outDir)).sort()).toEqual(['plugin-manifest.json', 'seat-picker.css', 'seat-picker.mjs']);
      expect(await fs.readFile(path.join(outDir, 'seat-picker.mjs'), 'utf-8')).toContain('data:image/svg+xml');
      expect((await readManifest(outDir)).assets['seat-picker.css']).toMatchObject({ type: 'style', isMain: true });
    });
  });
});

describe('packing a plugin package', () => {
  it('builds the package’s own entry and every declaration it lists', async () => {
    await inTemp(async dir => {
      await writeFiles(
        dir,
        scaffoldPlugin({
          packageName: 'plitzi-plugin-rating',
          elements: [
            { name: 'rating', title: 'Rating', description: '' },
            { name: 'stars', title: 'Stars', description: '' }
          ],
          owner: '',
          packageManager: 'npm',
          inProject: false
        })
      );

      const result = await packPlugin({
        root: dir,
        source: {
          kind: 'package',
          entry: path.join(dir, 'src/index.ts'),
          declarations: path.join(dir, 'src/declarations.ts')
        },
        base: 'rating',
        version: '0.1.0',
        outDir: path.join(dir, 'dist')
      });

      expect(result.types).toEqual(['rating', 'stars']);
      expect(await fs.readFile(path.join(dir, 'dist/rating.mjs'), 'utf-8')).toMatch(/as elements/);
    });
  });
});

describe('a plugin package’s types', () => {
  const ratingPackage = (dir: string) =>
    writeFiles(
      dir,
      scaffoldPlugin({
        packageName: 'plitzi-plugin-rating',
        elements: [{ name: 'rating', title: 'Rating', description: '' }],
        owner: '',
        packageManager: 'npm',
        inProject: false
      })
    );
  const packPackage = (dir: string) =>
    packPlugin({
      root: dir,
      source: {
        kind: 'package',
        entry: path.join(dir, 'src/index.ts'),
        declarations: path.join(dir, 'src/declarations.ts')
      },
      base: 'rating',
      version: '0.1.0',
      outDir: path.join(dir, 'dist'),
      types: true
    });

  it('writes them with the package’s own TypeScript, for what src/ holds', async () => {
    // Inside the workspace, where a TypeScript resolves — as it does in a package with its dependencies installed.
    const dir = await fs.mkdtemp(path.join(import.meta.dirname, '../../.pack-types-'));
    try {
      await ratingPackage(dir);

      const result = await packPackage(dir);

      expect(result.typesOutcome).toBe('written');
      expect(await fs.readFile(path.join(dir, 'dist/types/index.d.ts'), 'utf-8')).toContain('elements');
      expect((await fs.readdir(path.join(dir, 'dist/types/Rating'))).sort()).toContain('declaration.d.ts');
      // The page loads what the manifest lists, and the types are not among it.
      expect(Object.keys((await readManifest(path.join(dir, 'dist'))).assets)).toEqual(['rating.mjs']);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('says so when the package has no TypeScript to write them with, rather than failing the build', async () => {
    await inTemp(async dir => {
      await ratingPackage(dir);

      expect((await packPackage(dir)).typesOutcome).toBe('no-typescript');
    });
  });
});

describe('what is refused, and why', () => {
  const pack = (dir: string, folders: string[], outDir = path.join(dir, 'dist/out')) =>
    packPlugin({ root: dir, source: { kind: 'elements', folders }, base: 'x', version: '1.0.0', outDir });

  it('a folder that is not an element', async () => {
    await inTemp(async dir => {
      await writeFiles(path.join(dir, 'src/plugins/StatCard'), { 'index.ts': 'export default {};\n' });

      await expect(pack(dir, [path.join(dir, 'src/plugins/StatCard')])).rejects.toThrow(
        'src/plugins/StatCard has no declaration.ts'
      );
    });
  });

  it('a declaration missing what the manifest needs, named', async () => {
    await inTemp(async dir => {
      await writeFiles(path.join(dir, 'src/plugins/Broken'), {
        'index.ts': 'export default {};\n',
        'declaration.ts': "export default { type: 'broken', content: { attributes: {} } };\n"
      });

      await expect(pack(dir, [path.join(dir, 'src/plugins/Broken')])).rejects.toThrow(
        'the declaration has no `content.definition`'
      );
    });
  });

  it('two elements of one type', async () => {
    await inTemp(async dir => {
      await element(dir, 'seat-picker', 'Seats');
      const folder = path.join(dir, 'src/plugins/SeatPicker');

      await expect(pack(dir, [folder, folder])).rejects.toThrow('Two elements are both "seatPicker"');
    });
  });

  it('a build folder outside the project, since the build empties it first', async () => {
    await inTemp(async dir => {
      await element(dir, 'seat-picker', 'Seats');

      await expect(pack(dir, [path.join(dir, 'src/plugins/SeatPicker')], os.tmpdir())).rejects.toBeInstanceOf(
        PackError
      );
    });
  });
});
