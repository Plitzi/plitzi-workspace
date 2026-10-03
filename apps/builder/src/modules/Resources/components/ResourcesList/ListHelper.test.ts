import { describe, expect, it } from 'vitest';

import { getDirectories } from './ListHelper';

import type { Resource } from '@plitzi/sdk-shared';

const file = (id: string, type: Exclude<Resource['type'], 'plugin'>): Resource => ({
  id,
  cdnIdentifier: 'seed-cdn',
  bucketIdentifier: 'bucket',
  name: id.split('/').pop() ?? id,
  path: id,
  type,
  size: 1,
  usedBy: []
});

const names = (directories: ReturnType<typeof getDirectories>) => directories.map(directory => directory.name);

describe('getDirectories', () => {
  it('opens a public bucket on where uploads go, with its own folders beside them', () => {
    const directories = getDirectories('pizarra/assets', [
      file('pizarra/assets/logo.png', 'image'),
      file('pizarra/assets/icons/star.svg', 'image')
    ]);

    expect(names(directories).toSorted()).toEqual(['All Resources', 'Plugins', 'Snippets', 'icons']);
  });

  it('opens a private bucket on its server code alone: nothing is uploaded to it', () => {
    const directories = getDirectories(
      'pizarra/assets',
      [file('pizarra/server/runtimes/abc.bundle', 'server')],
      'private'
    );

    expect(names(directories)).toEqual(['Server code']);
    expect(directories[0]).toMatchObject({ canDrop: false, canRemove: false, isDefault: true });
  });

  it('still shows what a private bucket holds besides its server code', () => {
    const directories = getDirectories('pizarra/assets', [file('pizarra/assets/old.png', 'image')], 'private');

    expect(names(directories)).toEqual(['All Resources', 'Server code']);
  });
});
