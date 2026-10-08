import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { addFunctionsPackage } from './functionsAdd';

/**
 * `plitzi functions add`: a package the functions use, carried with them as a function carries its dependencies —
 * bundled into `src/functions/vendor/`, web APIs only.
 */

let project: string;
const said = { out: '', err: '' };

/** A package installed in the project, written as npm leaves one. */
const installed = async (name: string, files: Record<string, string>, manifest: Record<string, unknown> = {}) => {
  const dir = path.join(project, 'node_modules', name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({ name, version: '1.2.3', license: 'MIT', type: 'module', main: 'index.js', ...manifest })
  );
  for (const [file, text] of Object.entries(files)) {
    await fs.writeFile(path.join(dir, file), text);
  }
};

const vendored = (file: string) => fs.readFile(path.join(project, 'src/functions/vendor', file), 'utf8');

beforeEach(async () => {
  project = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-functions-add-'));
  await fs.writeFile(path.join(project, 'package.json'), '{"name":"site"}');
  vi.spyOn(process, 'cwd').mockReturnValue(project);
  said.out = '';
  said.err = '';
  vi.spyOn(console, 'log').mockImplementation((...values: unknown[]) => {
    said.out += `${values.join(' ')}\n`;
  });
  vi.spyOn(console, 'warn').mockImplementation((...values: unknown[]) => {
    said.err += `${values.join(' ')}\n`;
  });
  vi.spyOn(console, 'error').mockImplementation((...values: unknown[]) => {
    said.err += `${values.join(' ')}\n`;
  });
  process.exitCode = undefined;
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
  await fs.rm(project, { recursive: true, force: true });
});

describe('plitzi functions add', () => {
  it('bundles a package into vendor/, with its licence and its types, for a relative import', async () => {
    await installed('ical-lite', {
      'index.js':
        'import { unfold } from "./unfold.js";\nexport const parse = text => unfold(text).split("\\n");\nexport default parse;',
      'unfold.js': 'export const unfold = text => text.replace(/\\r?\\n /g, "");'
    });

    await addFunctionsPackage('ical-lite', {});

    const code = await vendored('ical-lite.js');
    expect(code).toMatch(/^\/\/ ical-lite@1\.2\.3 — MIT\. Added by `plitzi functions add ical-lite`/);
    // The bundle is the package's code, whole — its own import included — and runs as it would in the functions.
    const bundled = (await import(pathToFileURL(path.join(project, 'src/functions/vendor/ical-lite.js')).href)) as {
      default: (text: string) => string[];
    };
    expect(bundled.default('a\n b\nc')).toEqual(['ab', 'c']);
    expect(await vendored('ical-lite.d.ts')).toMatch(
      /export \* from 'ical-lite';\nexport \{ default \} from 'ical-lite';/
    );
    expect(said.out).toMatch(/import it from a file of src\/functions\/ with '\.\/vendor\/ical-lite\.js'/);
    expect(process.exitCode).toBeUndefined();
  });

  /** A runner has web APIs and nothing of Node: a package that needs it would fail where it runs, so it is not added. */
  it('refuses a package that reaches Node, saying what it reached', async () => {
    await installed('fs-reader', {
      'index.js': 'import fs from "fs";\nexport const read = file => fs.readFileSync(file);'
    });

    await addFunctionsPackage('fs-reader', {});

    expect(said.err).toContain('fs-reader reaches "fs", which the functions do not have');
    expect(process.exitCode).toBe(1);
    await expect(fs.access(path.join(project, 'src/functions/vendor'))).rejects.toThrow();
  });

  it('says to install a package first, and refuses what is not a package name', async () => {
    await addFunctionsPackage('not-installed', {});
    expect(said.err).toContain('not-installed is not installed in this project: install it first');

    await addFunctionsPackage('../escape', {});
    expect(said.err).toContain('"../escape" is not a package\'s name');
  });
});
