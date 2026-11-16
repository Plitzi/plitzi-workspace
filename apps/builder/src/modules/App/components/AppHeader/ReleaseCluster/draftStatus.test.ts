import { describe, expect, it } from 'vitest';

import { draftStatus } from './draftStatus';

import type { SpaceSnapshot, SpaceVersionChanges } from '@plitzi/sdk-shared';

const snapshot: SpaceSnapshot = {
  environment: 'production',
  revision: 12,
  description: '',
  publishedAt: '2026-11-16T10:00:00.000Z',
  by: null,
  domains: [],
  previewUrl: 'https://acme--r12-production-1-0123456789ab.plitzi.app/'
};
const changed = (total: number) => ({ total }) as SpaceVersionChanges;

describe('draftStatus', () => {
  it('says there is no snapshot yet, as pending', () => {
    expect(draftStatus(undefined, undefined)).toEqual({
      words: 'Draft · no snapshot yet',
      short: 'No snapshot',
      pending: true
    });
  });

  it('says the draft is kept when nothing changed since the last snapshot', () => {
    expect(draftStatus(snapshot, changed(0))).toEqual({
      words: 'Draft · kept as production r12',
      short: 'r12',
      pending: false
    });
  });

  it('counts what changed since the last snapshot', () => {
    expect(draftStatus(snapshot, changed(4))).toMatchObject({
      words: 'Draft · 4 changes since production r12',
      pending: true
    });
    expect(draftStatus(snapshot, changed(1)).words).toBe('Draft · 1 change since production r12');
  });
});
