import { describe, expect, it } from 'vitest';

import { removedFolder } from './removedFolder';

// encore-12: a `run notice` from a task's copy removed at its approval printed Node's stack and its version banner.
describe('a command started from a removed folder', () => {
  it('is refused saying so, as an invalid refusal — and nothing is said from a folder that is there', () => {
    const gone = removedFolder(() => {
      throw Object.assign(new Error('ENOENT: process.cwd failed'), { code: 'ENOENT' });
    });
    expect(gone).toEqual({
      text: expect.stringContaining('the folder this shell is in was removed') as unknown,
      code: 20
    });
    expect(removedFolder(() => '/project')).toBeUndefined();
  });
});
