import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { afterAll, describe, expect, it } from 'vitest';

import { createSqliteKv } from './kv';
import { describeKv } from '../actions/jobs/testing/jobQueueContract';

const folders: string[] = [];
const fileIn = (): string => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'plitzi-sqlite-kv-'));
  folders.push(folder);

  return path.join(folder, 'data', 'kv.sqlite');
};

afterAll(() => {
  folders.forEach(folder => fs.rmSync(folder, { recursive: true, force: true }));
});

describeKv('sqlite', () => Promise.resolve({ kv: createSqliteKv({ file: fileIn() }), clear: () => Promise.resolve() }));

describe('createSqliteKv', () => {
  it('is one store for every connection to the file: a restart, or a second process', async () => {
    const file = fileIn();
    const first = createSqliteKv({ file });
    const second = createSqliteKv({ file });

    await first.set('saved:layout', '{"windows":2}');
    await second.increment('visits', 2);
    await first.increment('visits', 3);

    expect(await second.get('saved:layout')).toBe('{"windows":2}');
    expect(await createSqliteKv({ file }).get('visits')).toBe('5');
  });

  it('takes a free key once, whichever connection asks first', async () => {
    const file = fileIn();
    const one = createSqliteKv({ file });
    const other = createSqliteKv({ file });

    expect(await one.swap('job:7', undefined, 'replica-a', 60)).toBe(true);
    expect(await other.swap('job:7', undefined, 'replica-b', 60)).toBe(false);
    expect(await other.get('job:7')).toBe('replica-a');
  });

  it('lives beside a deployment’s own tables, in a table it names', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE jobs (id TEXT PRIMARY KEY)');
    const kv = createSqliteKv({ db, table: 'queue_kv' });
    await kv.set('a', '1');

    expect(db.prepare('SELECT value FROM queue_kv WHERE key = ?').get('a')).toEqual({ value: '1' });
  });

  it('refuses a table name it would have to quote', () => {
    expect(() => createSqliteKv({ db: new DatabaseSync(':memory:'), table: 'kv; DROP TABLE jobs' })).toThrow(
      'is not a table name'
    );
  });
});
