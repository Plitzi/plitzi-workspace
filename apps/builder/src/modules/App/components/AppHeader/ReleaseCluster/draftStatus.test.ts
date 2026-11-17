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
  it('says there is no version yet, as pending', () => {
    expect(draftStatus(undefined, undefined)).toEqual({
      words: 'Draft · no versions yet',
      short: 'No versions',
      pending: true
    });
  });

  it('says the draft is kept when nothing changed since the last snapshot', () => {
    expect(draftStatus(snapshot, changed(0))).toEqual({
      words: 'Draft · kept as version 12',
      short: 'v12',
      pending: false
    });
  });

  it('counts what changed since the last snapshot', () => {
    expect(draftStatus(snapshot, changed(4))).toMatchObject({
      words: 'Draft · 4 changes since version 12',
      pending: true
    });
    expect(draftStatus(snapshot, changed(1)).words).toBe('Draft · 1 change since version 12');
  });
});
