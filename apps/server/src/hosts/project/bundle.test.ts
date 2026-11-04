import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { bundleProject } from './bundle';

const roots: string[] = [];

/** A project on disk: its files by path, and packages in its `node_modules` by name. */
const project = (files: Record<string, string>, packages: Record<string, Record<string, unknown>> = {}): string => {
  const root = mkdtempSync(path.join(tmpdir(), 'plitzi-bundle-'));
  roots.push(root);
  const write = (file: string, text: string) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  };
  write('package.json', JSON.stringify({ name: 'shop', type: 'module' }));
  Object.entries(files).forEach(([file, text]) => write(file, text));
  Object.entries(packages).forEach(([name, manifest]) => {
    write(`node_modules/${name}/package.json`, JSON.stringify({ name, type: 'module', main: 'index.js', ...manifest }));
    write(`node_modules/${name}/index.js`, `export const which = ${JSON.stringify(name)};\n`);
  });

  return root;
};

afterEach(() => {
  roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true }));
});

describe('bundleProject', () => {
  it('writes the server and the modules it imports by their path, sharing what they share', async () => {
    const root = project(
      {
        'src/main.ts':
          "import { which } from 'tidy';\nimport { label } from './label.ts';\nconsole.log(which, label);\n",
        'src/label.ts': "export const label: string = 'shared';\n",
        'src/space/index.ts':
          "import { which } from 'tidy';\nimport { label } from '../label.ts';\nexport const space = { name: label, which };\n"
      },
      { tidy: {} }
    );
    // A package's own relative imports are the package's: bundled with it, not left as files of the project.
    writeFileSync(path.join(root, 'node_modules/tidy/index.js'), "export { which } from './which.js';\n");
    writeFileSync(path.join(root, 'node_modules/tidy/which.js'), "export const which = 'tidy';\n");

    const bundled = await bundleProject({ root });

    expect(bundled.modules).toBe(3);
    expect(existsSync(path.join(root, 'dist/main.js'))).toBe(true);
    expect(existsSync(path.join(root, 'dist/space/index.js'))).toBe(true);
    // A package that is plain code goes in, in a chunk both share; a module of the project stays a file of its own.
    expect(readFileSync(path.join(root, 'dist/main.js'), 'utf-8')).not.toMatch(/from "tidy"/);
    expect(readFileSync(path.join(root, 'dist/space/index.js'), 'utf-8')).not.toMatch(/from "tidy"/);
    expect(readFileSync(path.join(root, 'dist/main.js'), 'utf-8')).toContain('"./label.js"');
    expect(existsSync(path.join(root, 'dist/label.js'))).toBe(true);
    expect(bundled.chunks).toBeGreaterThan(0);
    expect(execFileSync(process.execPath, ['dist/main.js'], { cwd: root, encoding: 'utf-8' }).trim()).toBe(
      'tidy shared'
    );
  });

  // The project's code finds what is beside it by where it is: a folder read as it runs, in the build as in the source.
  it('keeps every module of the project where its source is, so one finds its folder by its own address', async () => {
    const root = project({
      'src/main.ts': [
        "import { readdirSync } from 'node:fs';",
        "import { fileURLToPath } from 'node:url';",
        "const dir = fileURLToPath(new URL('./actions/', import.meta.url));",
        "const names = readdirSync(dir).filter(file => file.endsWith('.js')).sort();",
        'const loaded = await Promise.all(names.map(file => import(new URL(`./actions/${file}`, import.meta.url).href)));',
        "console.log(loaded.map(module => module.name).join(','));"
      ].join('\n'),
      'src/actions/refund.ts': "export const name: string = 'refund';\n",
      'src/actions/ship.ts': "export const name: string = 'ship';\n",
      'src/plugins/Badge/index.ts': 'export default () => null;\n',
      // What the space imports of a plugin is no module the build writes a file for: it goes in with the space.
      'src/plugins/Badge/declaration.ts': "export const type: string = 'badge';\n",
      'src/space/index.ts': "import { type } from '../plugins/Badge/declaration.ts';\nexport const space = { type };\n",
      'src/functions/index.ts': 'export default {};\n'
    });

    await bundleProject({ root });

    expect(execFileSync(process.execPath, ['dist/main.js'], { cwd: root, encoding: 'utf-8' }).trim()).toBe(
      'refund,ship'
    );
    const { space } = (await import(path.join(root, 'dist/space/index.js'))) as { space: unknown };
    expect(space).toEqual({ type: 'badge' });
    // Built by the server from their source when it starts: never ahead.
    expect(existsSync(path.join(root, 'dist/plugins'))).toBe(false);
    expect(existsSync(path.join(root, 'dist/functions'))).toBe(false);
  });

  it('leaves React, the SDK and a native package to node_modules, a native one found by its manifest', async () => {
    const root = project(
      {
        'src/main.ts': [
          "import { which as native } from 'bound';",
          "import { which as react } from 'react';",
          "import { which as sdk } from '@plitzi/plitzi-sdk';",
          'console.log(native, react, sdk);'
        ].join('\n')
      },
      { bound: { gypfile: true }, react: {}, '@plitzi/plitzi-sdk': {} }
    );

    await bundleProject({ root });
    const main = readFileSync(path.join(root, 'dist/main.js'), 'utf-8');

    expect(main).toContain('"bound"');
    expect(main).toContain('"react"');
    expect(main).toContain('"@plitzi/plitzi-sdk"');
    expect(execFileSync(process.execPath, ['dist/main.js'], { cwd: root, encoding: 'utf-8' }).trim()).toBe(
      'bound react @plitzi/plitzi-sdk'
    );
  });
});
