import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runMigrations } from './run';

import type { Migration } from './types';

/** A rename, the one kind of change with a single right answer: found by word, rewritten when asked. */
const rename = (id: string, since: string, from: string, to: string, scope: Migration['scope']): Migration => ({
  id,
  since,
  scope,
  start:
    () =>
    ({ text }) =>
      Promise.resolve(
        [...text.matchAll(new RegExp(from, 'g'))].map(match => ({
          line: text.slice(0, match.index).split('\n').length,
          what: `${from} is ${to} now`,
          edit: { start: match.index, end: match.index + from.length, text: to }
        }))
      )
});

/** A change only said: the author decides. */
const said: Migration = {
  id: 'said',
  since: '0.1.0',
  scope: 'always',
  start:
    () =>
    ({ text }) =>
      Promise.resolve(text.includes('legacy') ? [{ line: 1, what: 'look at it' }] : [])
};

describe('runMigrations', () => {
  let root = '';
  const read = (file: string) => fs.readFile(path.join(root, file), 'utf-8');

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-migrations-'));
    await fs.mkdir(path.join(root, 'src'), { recursive: true });
    await fs.writeFile(path.join(root, 'src', 'page.ts'), 'oldName(legacy);\n');
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('says where without writing, and writes only an edit when asked — each reading what the one before wrote', async () => {
    const migrations = [
      rename('first', '0.1.0', 'oldName', 'midName', 'always'),
      rename('second', '0.2.0', 'midName', 'newName', 'always'),
      said
    ];

    const shown = await runMigrations({ root, lastUpgraded: undefined }, migrations, { write: false });
    expect(shown.map(found => [found.migration, found.written])).toEqual([
      ['first', false],
      ['said', false]
    ]);
    expect(await read('src/page.ts')).toBe('oldName(legacy);\n');

    const written = await runMigrations({ root, lastUpgraded: undefined }, migrations, { write: true });
    expect(written.map(found => [found.migration, found.written])).toEqual([
      ['first', true],
      ['second', true],
      ['said', false]
    ]);
    expect(await read('src/page.ts')).toBe('newName(legacy);\n');
  });

  it('writes the places that have one right answer and says the rest, in the same file', async () => {
    const partly: Migration = {
      id: 'partly',
      since: '0.1.0',
      scope: 'always',
      start: () => () =>
        Promise.resolve([
          { line: 1, what: 'renamed', edit: { start: 0, end: 7, text: 'newName' } },
          { line: 1, what: 'yours to decide' }
        ])
    };

    const found = await runMigrations({ root, lastUpgraded: undefined }, [partly], { write: true });
    expect(found.map(each => [each.what, each.writable, each.written])).toEqual([
      ['renamed', true, true],
      ['yours to decide', false, false]
    ]);
    expect(found[0]).not.toHaveProperty('edit');
    expect(await read('src/page.ts')).toBe('newName(legacy);\n');
  });

  it('refuses a migration whose edits overlap, leaving the file as it was', async () => {
    const overlapping: Migration = {
      id: 'overlapping',
      since: '0.1.0',
      scope: 'always',
      start: () => () =>
        Promise.resolve([
          { line: 1, what: 'a', edit: { start: 0, end: 5, text: 'x' } },
          { line: 1, what: 'b', edit: { start: 3, end: 8, text: 'y' } }
        ])
    };

    await expect(runMigrations({ root, lastUpgraded: undefined }, [overlapping], { write: true })).rejects.toThrow(
      /overlapping edits in src\/page\.ts/
    );
    expect(await read('src/page.ts')).toBe('oldName(legacy);\n');
  });

  it('looks for an until-upgraded change only in a project last upgraded before it, or with no record', async () => {
    const migrations = [rename('flip', '0.5.0', 'oldName', 'newName', 'until-upgraded')];
    const found = (lastUpgraded: string | undefined) =>
      runMigrations({ root, lastUpgraded }, migrations, { write: false }).then(list => list.length);

    expect(await found(undefined)).toBe(1);
    expect(await found('0.4.9')).toBe(1);
    expect(await found('0.5.0')).toBe(0);
    expect(await found('0.6.1')).toBe(0);
  });
});
