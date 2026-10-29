import { describe, expect, it } from 'vitest';

import { isFunctionsSourcePath, isFunctionsTestPath, readFunctionsSource } from './functions';

describe('a space’s functions source', () => {
  it('is relative files of the languages a build takes, inside the folder', () => {
    expect(['index.ts', 'lib/feed.ts', 'data.json', 'util.mjs'].every(isFunctionsSourcePath)).toBe(true);
    expect(['../x.ts', 'a/../b.ts', '/abs.ts', 'README.md', 'lib//x.ts', './x.ts'].some(isFunctionsSourcePath)).toBe(
      false
    );
  });

  // A run's push sent 33 files to the platform, a third of them tests and the fixtures only they read.
  it('leaves the tests and what only they read in the project', () => {
    expect(['cyclones.test.ts', 'lib/feed.spec.ts', 'nhc-down.fixture.json'].every(isFunctionsTestPath)).toBe(true);
    expect(['cyclones.ts', 'lib/testing.ts', 'data.json', 'contest.ts'].some(isFunctionsTestPath)).toBe(false);
  });

  it('reads a directory’s source files by path, skipping what is not source', async () => {
    const tree: Record<string, { name: string; directory: boolean }[]> = {
      root: [
        { name: 'index.ts', directory: false },
        { name: 'index.test.ts', directory: false },
        { name: 'notes.md', directory: false },
        { name: 'lib', directory: true },
        { name: 'node_modules', directory: true },
        { name: '.cache', directory: true }
      ],
      'root/lib': [{ name: 'feed.ts', directory: false }]
    };
    const source = await readFunctionsSource('root', {
      list: dir => (Object.hasOwn(tree, dir) ? Promise.resolve(tree[dir]) : Promise.reject(new Error('none'))),
      read: file => Promise.resolve(`// ${file}`)
    });

    expect(source).toEqual({ 'index.ts': '// root/index.ts', 'lib/feed.ts': '// root/lib/feed.ts' });
  });

  it('reads nothing where there is no directory', async () => {
    expect(
      await readFunctionsSource('missing', {
        list: () => Promise.reject(new Error('ENOENT')),
        read: () => Promise.resolve('')
      })
    ).toEqual({});
  });
});
