import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createExclusive } from './files';
import { copyOf, runPaths, taskPaths } from './paths';
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
