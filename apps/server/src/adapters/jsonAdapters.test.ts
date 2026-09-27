import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createJsonAdapters } from './jsonAdapters';

const spaceWithTitle = (title: string) => ({ schema: { settings: { title } }, style: {} });

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'json-adapters-'));
  file = path.join(dir, 'space.json');
  writeFileSync(file, JSON.stringify(spaceWithTitle('first')));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('createJsonAdapters — reading the space', () => {
  it('parses the file once while it has not changed', async () => {
    const { getOfflineData } = createJsonAdapters({ offlineData: file });

    const first = await getOfflineData(1, 'production');
    const second = await getOfflineData(1, 'production');

    expect(second).toBe(first);
  });

  it('reads the file again once it was edited', async () => {
    const { getOfflineData } = createJsonAdapters({ offlineData: file });
    await getOfflineData(1, 'production');

    writeFileSync(file, JSON.stringify(spaceWithTitle('edited by hand')));
    const later = new Date(Date.now() + 5000);
    utimesSync(file, later, later);

    expect(await getOfflineData(1, 'production')).toMatchObject({ schema: { settings: { title: 'edited by hand' } } });
  });

  it('reads again after its own save, even when size and mtime cannot tell', async () => {
    const stamp = new Date('2026-01-01T00:00:00Z');
    writeFileSync(file, JSON.stringify(spaceWithTitle('first'), null, 2));
    utimesSync(file, stamp, stamp);
    const { getOfflineData, saveOfflineData } = createJsonAdapters({ offlineData: file });
    const read = await getOfflineData(1, 'main');
    if (!read) {
      throw new Error('the space did not load');
    }

    // The same bytes, stamped with the same time: what a save inside the same clock tick looks like to a stat.
    await saveOfflineData?.(1, 'main', { ...read });
    utimesSync(file, stamp, stamp);

    const after = await getOfflineData(1, 'main');

    expect(after).not.toBe(read);
    expect(after).toEqual(read);
  });
});
