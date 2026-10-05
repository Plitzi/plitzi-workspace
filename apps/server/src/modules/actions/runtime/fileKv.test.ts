import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { createFileKv } from './fileKv';
import { describeKv } from '../jobs/testing/jobQueueContract';

const folders: string[] = [];
const fileIn = (name = 'kv.json'): string => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'plitzi-file-kv-'));
  folders.push(folder);

  return path.join(folder, 'data', name);
};

afterAll(() => {
  folders.forEach(folder => fs.rmSync(folder, { recursive: true, force: true }));
});

describeKv('file', () => Promise.resolve({ kv: createFileKv({ file: fileIn() }), clear: () => Promise.resolve() }));

describe('createFileKv', () => {
  it('keeps what was written across a restart, in a file it creates with its folder', async () => {
    const file = fileIn();
    const before = createFileKv({ file });
    await before.set('saved:layout', '{"windows":2}');
    await before.increment('visits', 3);
    await before.flush();

    const after = createFileKv({ file });

    expect(await after.get('saved:layout')).toBe('{"windows":2}');
    expect(await after.get('visits')).toBe('3');
  });

  it('keeps a lifetime as an instant, and does not bring back what lapsed while it was stopped', async () => {
    const file = fileIn();
    const before = createFileKv({ file });
    await before.set('cache', 'fresh', 60);
    await before.set('gone', 'soon', 1);
    await before.flush();

    const document = JSON.parse(fs.readFileSync(file, 'utf8')) as { entries: Record<string, { expiresAt?: number }> };
    expect(document.entries.cache.expiresAt).toBeGreaterThan(Date.now());

    vi.useFakeTimers({ now: Date.now() + 2_000, toFake: ['Date'] });
    try {
      const after = createFileKv({ file });

      expect(await after.get('cache')).toBe('fresh');
      expect(await after.get('gone')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('writes a deletion too', async () => {
    const file = fileIn();
    const before = createFileKv({ file });
    await before.set('a', '1');
    await before.delete('a');
    await before.flush();

    expect(await createFileKv({ file }).get('a')).toBeUndefined();
  });

  it('writes the changes made together as one file, and every change that came after a write began', async () => {
    const file = fileIn();
    const kv = createFileKv({ file });
    const renames = vi.spyOn(fs.promises, 'rename');
    try {
      await Promise.all(Array.from({ length: 50 }, (_, index) => kv.set(`key:${String(index)}`, String(index))));
      await kv.flush();

      expect(renames.mock.calls.length).toBeGreaterThan(0);
      expect(renames.mock.calls.length).toBeLessThan(5);
      const reopened = createFileKv({ file });
      expect(await reopened.get('key:0')).toBe('0');
      expect(await reopened.get('key:49')).toBe('49');
    } finally {
      renames.mockRestore();
    }
  });

  it('refuses a file it did not write, naming it and what to do', () => {
    const file = fileIn();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{"saved:streams":"[]"}');

    expect(() => createFileKv({ file })).toThrow(`${file} is not a store it wrote (no \`format: 1\`)`);
  });

  it('refuses a file that is not JSON', () => {
    const file = fileIn();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{ half');

    expect(() => createFileKv({ file })).toThrow('is not a store it wrote');
  });
});
