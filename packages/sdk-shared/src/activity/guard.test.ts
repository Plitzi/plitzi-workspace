import { describe, expect, it } from 'vitest';

import { isSpaceActivityPage } from './guard';

const page = {
  activity: [
    { kind: 'action', at: 1, actionId: 'signup', trigger: 'call', status: 'failed' },
    { kind: 'publish', at: 2, author: { userId: 1, name: 'ana' }, what: 'publish', message: 'Published' }
  ],
  cursor: 'c',
  more: false,
  waitedMs: 0,
  skippedMine: 0
};

describe('isSpaceActivityPage', () => {
  it('takes a page the platform answers', () => {
    expect(isSpaceActivityPage(page)).toBe(true);
  });

  it('refuses a page without a cursor to follow it from, or with a kind it does not know', () => {
    expect(isSpaceActivityPage({ ...page, cursor: undefined })).toBe(false);
    expect(isSpaceActivityPage({ ...page, activity: [{ kind: 'runtime', at: 1 }] })).toBe(false);
    expect(isSpaceActivityPage({ error: 'Not found' })).toBe(false);
  });
});
