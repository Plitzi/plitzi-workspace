import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { exportBlob, fileNavigationOf, orderedPaths, singleFileOf } from './exportFiles';

import type { SpaceExport } from './exportFiles';

const spaceExport = (files: Record<string, string>, fileName = 'site.ts'): SpaceExport => ({
  format: 'authoring',
  fileName,
  files,
  corrections: [],
  differences: []
});

describe('singleFileOf', () => {
  it('answers the one file of a single-file export, and nothing for a split one', () => {
    expect(singleFileOf(spaceExport({ 'site.ts': 'export {};' }))).toBe('export {};');
    expect(singleFileOf(spaceExport({ 'index.ts': 'a', 'pages/home.ts': 'b' }))).toBeUndefined();
  });
});

describe('exportBlob', () => {
  it('saves a single-file export as the file itself', async () => {
    const blob = await exportBlob(spaceExport({ 'site.ts': 'export {};' }));

    expect(await blob.text()).toBe('export {};');
  });

  it('zips a split export in its folder structure', async () => {
    const blob = await exportBlob(spaceExport({ 'index.ts': 'a', 'pages/home.ts': 'b' }, 'site.zip'));
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());

    expect(await zip.file('pages/home.ts')?.async('string')).toBe('b');
    expect(await zip.file('index.ts')?.async('string')).toBe('a');
  });
});

describe('orderedPaths', () => {
  it('puts the space first, what sits beside it next, and each folder by name', () => {
    expect(
      orderedPaths({ 'pages/b.ts': '', 'styles.ts': '', 'layouts/a.ts': '', 'index.ts': '', 'pages/a.ts': '' })
    ).toEqual(['index.ts', 'styles.ts', 'layouts/a.ts', 'pages/a.ts', 'pages/b.ts']);
  });
});

describe('fileNavigationOf', () => {
  it('offers a few files as tabs, many as a list, and one not at all', () => {
    expect(fileNavigationOf(['site.ts'])).toBe('none');
    expect(fileNavigationOf(['schema.json', 'style.json'])).toBe('tabs');
    expect(fileNavigationOf(['index.ts', 'styles.ts', 'pages/a.ts', 'pages/b.ts'])).toBe('list');
  });
});
