import { readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MIGRATIONS } from '.';
import { compareVersions, versionOf } from '../doctor/versions';

import type { Version } from '../doctor/versions';

describe('MIGRATIONS', () => {
  it('lists every file of changes/, each named by its file — and nothing else', () => {
    const files = readdirSync(path.join(import.meta.dirname, 'changes'))
      .filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts'))
      .map(file => path.basename(file, '.ts'));

    expect(MIGRATIONS.map(migration => migration.id).sort()).toEqual(files.sort());
  });

  it('keeps them oldest first, each since a version', () => {
    const versions = MIGRATIONS.map(migration => versionOf(migration.since)).filter(
      (version): version is Version => version !== undefined
    );

    expect(versions).toHaveLength(MIGRATIONS.length);
    expect([...versions].sort(compareVersions)).toEqual(versions);
  });
});
