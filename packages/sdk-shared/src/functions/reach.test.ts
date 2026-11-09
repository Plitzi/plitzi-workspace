import { describe, expect, it } from 'vitest';

import { importReach } from '../tests/importGraph';

// A runner and a worker load this folder: what it loads, they load. It must never be where React or a UI library
// comes in (RFC 0032 D5).
describe('what loading the functions protocol loads', () => {
  it('is its own files, and no other package', () => {
    const { files, packages } = importReach('functions');

    expect(Object.fromEntries(packages)).toEqual({});
    // Beside its own: `isRecord`, and where a space's functions answer HTTP (`/fn`), which a runtime's endpoints keep off.
    const beside = new Set(['helpers/isRecord.ts', 'actions/functions.ts']);
    expect(files.filter(file => !file.startsWith('functions/') && !beside.has(file))).toEqual([]);
  });
});
