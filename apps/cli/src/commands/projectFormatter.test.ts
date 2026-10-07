import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { projectFormatter } from './projectFormatter';

/** What `plitzi space pull` formats the space's files with before comparing them: the project's own Prettier. */

// Loading the project's Prettier is an import of all of it: far over 5 s on a machine running every package's tests.
describe('a project’s formatter', { timeout: 30_000 }, () => {
  it('formats with the Prettier the project installed', async () => {
    const format = await projectFormatter(path.resolve(import.meta.dirname, '../..'));

    expect(await format('src/a.ts', 'const a = {b:1}')).toBe('const a = { b: 1 };\n');
  });

  it('leaves a file alone in a project that has none', async () => {
    const format = await projectFormatter('/');

    expect(await format('src/a.ts', 'const a = {b:1}')).toBe('const a = {b:1}');
  });
});
