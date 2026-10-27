import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { scratchOf } from './paths';

// A scout's commands in the run's work it copied to its scratch were refused: the copy read as a project of its own.
describe('a folder under a run’s scratch', () => {
  it('is the run’s, its project the one above — and nothing else is', () => {
    const root = path.join(path.sep, 'p', 'encore');
    const runs = path.join(root, 'tmp', 'plitzi-runs', 'r1');

    expect(scratchOf(path.join(runs, 'scratch', 'scout-1', 'run-copy'))).toEqual({ root, run: 'r1' });
    expect(scratchOf(path.join(runs, 'tasks', 't-home', 'cache', 'work'))).toBeUndefined();
    expect(scratchOf(root)).toBeUndefined();
  });
});
