import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { fixChanged } from './fix';

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-fix-'));
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ scripts: { lint: 'eslint .', format: 'prettier --write .' } })
  );
  // Stand-ins of the project's tools: each says it ran on the files it was handed, as the real ones rewrite them.
  await fs.mkdir(path.join(root, 'node_modules', '.bin'), { recursive: true });
  for (const tool of ['eslint', 'prettier']) {
    const bin = path.join(root, 'node_modules', '.bin', tool);
    await fs.writeFile(
      bin,
      `#!/bin/sh\nfor f in "$@"; do case "$f" in -*) ;; *) echo "// ${tool}" >> "$f" ;; esac; done\n`
    );
    await fs.chmod(bin, 0o755);
  }

  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'mine.ts'), 'export const a = 1\n');
  await fs.writeFile(path.join(root, 'src', 'theirs.ts'), 'export const b = 2\n');
  await fs.writeFile(path.join(root, 'src', 'data.json'), '{}\n');
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

// velada-polish's dev-1: three checks in twenty seconds, twice, each failing on what a lint --fix writes.
describe('task check --fix', () => {
  it('runs the project’s linter and formatter on the task’s changed files alone, and says what they rewrote', async () => {
    const fixed = await fixChanged(root, root, ['src/mine.ts', 'src/data.json']);

    expect(fixed).toEqual({ ran: ['eslint --fix', 'prettier --write'], fixed: ['src/mine.ts', 'src/data.json'] });
    expect(await fs.readFile(path.join(root, 'src', 'mine.ts'), 'utf-8')).toBe(
      'export const a = 1\n// eslint\n// prettier\n'
    );
    // Linted as code only; another task's file never touched.
    expect(await fs.readFile(path.join(root, 'src', 'data.json'), 'utf-8')).toBe('{}\n// prettier\n');
    expect(await fs.readFile(path.join(root, 'src', 'theirs.ts'), 'utf-8')).toBe('export const b = 2\n');
  });

  it('runs nothing where the project has no such scripts, or the task changed nothing', async () => {
    expect(await fixChanged(root, root, [])).toEqual({ fixed: [], ran: [] });
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: {} }));
    expect(await fixChanged(root, root, ['src/mine.ts'])).toEqual({ fixed: [], ran: [] });
  });
});
