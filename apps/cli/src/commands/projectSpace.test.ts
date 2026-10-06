/* eslint-disable quotes -- the cases are source code, which reads best in the other quotes */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadProjectSpace } from './projectSpace';

/**
 * The space the CLI's own checks author — `check`, `push`, `fix`, `lint` — held first to the layout `npm run author` and
 * the server hold it to: what they refuse, it refuses, in the same words.
 */

let root = '';

const write = async (file: string, text = ''): Promise<void> => {
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await fs.writeFile(path.join(root, file), text);
};

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-project-space-'));
  await write('package.json', '{}\n');
  await write('plitzi/author.ts');
  await write('.env');
  await write('.env.example');
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('the space a CLI check authors', () => {
  it('is the project’s, with what it is checked against', async () => {
    await write('src/space/index.ts', "export const space = { name: 'Shop', permanentUrl: 'shop', pages: [] };\n");

    const loaded = await loadProjectSpace(root);

    expect(loaded).toMatchObject({ space: { name: 'Shop' }, authoring: { plugins: [], pluginTypes: [] } });
  });

  // A space folder with no index is said as the layout says it — with every other error — not as a module Node lacks.
  it('is refused with every error of the layout before the space is imported', async () => {
    await write('src/space/pages.ts', 'export const pages = [];\n');
    await write('src/plugins/Card/Card.tsx', 'export default () => null;\n');

    const loaded = await loadProjectSpace(root);

    expect(loaded).toHaveProperty('problem');
    const { problem } = loaded as { problem: string };
    expect(problem).toMatch(/^The project is not laid out as Plitzi reads it — 2 errors:/);
    expect(problem).toContain('src/plugins/Card/ has no index.ts (or index.tsx)');
    expect(problem).toContain('src/space/ has no index.ts');
  });

  it('is refused when the module exports no space by its name', async () => {
    await write('src/space/index.ts', 'export const site = {};\n');

    expect(await loadProjectSpace(root)).toEqual({ problem: 'src/space/index.ts exports no `space`.' });
  });
});
