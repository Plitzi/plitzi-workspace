import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createExclusive, fingerprint } from './files';
import { copyOf, runPaths, taskPaths } from './paths';
import { placeVersion } from './store';
import { claimFile, releaseFile, waitForFile } from './tasks';
import { makeBench } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/** The run’s primitives: turns let go, locks, digests. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { open, take } = runSteps(() => bench);

describe('a folder of a task’s copy', () => {
  it('is read off its path: the project it belongs to, its run and its task — and nothing else is one', () => {
    const work = taskPaths(runPaths('/home/ana/shop', 'es-launch'), 't-home').work;
    expect(copyOf(work)).toEqual({ root: '/home/ana/shop', run: 'es-launch', task: 't-home' });
    expect(copyOf(path.join(work, 'src'))).toEqual({ root: '/home/ana/shop', run: 'es-launch', task: 't-home' });
    expect(copyOf(runPaths('/home/ana/shop', 'es-launch').dir)).toBeUndefined();
    expect(copyOf('/home/ana/shop')).toBeUndefined();
  });
});

describe('a unit that is a folder, backed up as a path', () => {
  it('has no fingerprint once it is a folder, and is put back by going only once it is empty', async () => {
    const folder = path.join(bench.root, 'src/plugins/Board');
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(path.join(folder, 'index.ts'), 'export {};\n');
    const paths = runPaths(bench.root, 'es-launch');

    expect(await fingerprint(folder)).toBeNull();
    await placeVersion(paths, folder, null, bench.root);
    expect((await fs.stat(folder)).isDirectory()).toBe(true);
    await fs.rm(path.join(folder, 'index.ts'));
    await placeVersion(paths, folder, null, bench.root);
    await expect(fs.access(folder)).rejects.toThrow();
  });

  // lx-copy: t-base removed the StatCard plugin's files, and its empty folder stayed in every copy, the preview and the
  // run's work — where every folder of src/plugins/ is a plugin, and the server refused to start.
  it('takes the folders a removal leaves empty, up to the tree it is placed in and never past it', async () => {
    const plugins = path.join(bench.root, 'src/plugins');
    const plugin = path.join(plugins, 'StatCard');
    await fs.mkdir(plugin, { recursive: true });
    await fs.writeFile(path.join(plugins, '.gitkeep'), '');
    await fs.writeFile(path.join(plugin, 'index.ts'), 'export {};\n');
    await fs.writeFile(path.join(plugin, 'StatCard.tsx'), 'export {};\n');
    const paths = runPaths(bench.root, 'es-launch');

    await placeVersion(paths, path.join(plugin, 'index.ts'), null, bench.root);
    expect((await fs.readdir(plugin)).sort()).toEqual(['StatCard.tsx']);
    await placeVersion(paths, path.join(plugin, 'StatCard.tsx'), null, bench.root);
    await expect(fs.access(plugin)).rejects.toThrow();
    const left = await fs.readdir(plugins);
    expect(left).toContain('.gitkeep');
    expect(left).not.toContain('StatCard');

    // A tree that is itself the empty folder stays: the root is never removed.
    const tree = path.join(bench.root, 'tmp/check-tree');
    await fs.mkdir(path.join(tree, 'src'), { recursive: true });
    await fs.writeFile(path.join(tree, 'src/only.ts'), '');
    await placeVersion(paths, path.join(tree, 'src/only.ts'), null, tree);
    expect(await fs.readdir(tree)).toEqual([]);
  });
});

describe('turns let go', () => {
  it('releases a file held by turns to the next in line', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const menu = await take('agent-2', 't-menu');
    await claimFile(home.ctx, 'es-launch', 't-home', 'src/space/tokens.ts');
    await waitForFile(menu.ctx, 'es-launch', 't-menu', 'src/space/tokens.ts');

    expect(await releaseFile(home.ctx, 'es-launch', 't-home', 'src/space/tokens.ts')).toEqual([
      'src/space/tokens.ts → t-menu'
    ]);
  });
});

describe('the run’s primitives', () => {
  it('creates a file exclusively: one caller of many', async () => {
    const file = path.join(bench.root, 'owner.json');
    const results = await Promise.all(Array.from({ length: 20 }, (_, n) => createExclusive(file, String(n))));

    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
