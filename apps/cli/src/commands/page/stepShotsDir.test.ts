import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { stepShotsDir } from './play';

// A reviewer's `shot` steps wrote into the copy of the task it reviewed.
describe('where a shot step pictures', () => {
  it('is the project’s tmp/shots — in a task’s copy, the run’s pictures of that task', () => {
    const root = path.join(path.sep, 'p', 'encore');
    const copy = path.join(root, 'tmp', 'plitzi-runs', 'r1', 'tasks', 't-home', 'cache', 'work');

    expect(stepShotsDir(root)).toBe(path.join(root, 'tmp', 'shots'));
    expect(stepShotsDir(copy)).toBe(path.join(root, 'tmp', 'plitzi-runs', 'r1', 'shots', 't-home'));
  });
});
