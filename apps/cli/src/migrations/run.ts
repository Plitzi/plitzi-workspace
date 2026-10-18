import fs from 'node:fs/promises';
import path from 'node:path';

import { compareVersions, versionOf } from '../doctor/versions';

import type { Migration, MigrationEdit, MigrationFinding, MigrationProject } from './types';

/** The project's own source: TypeScript and JavaScript under `src/` and `visual/`, never what was installed or built. */
const sourceFiles = async (root: string): Promise<string[]> => {
  const found: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await fs.readdir(path.join(root, dir), { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const relative = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(relative);
      } else if (/\.(ts|tsx|mts|js|jsx|mjs)$/.test(entry.name)) {
        found.push(relative);
      }
    }
  };
  await walk('src');
  await walk('visual');

  return found;
};

/** Whether the project is to be looked at for `migration`: see `Migration.scope`. */
const isDue = (migration: Migration, { lastUpgraded }: MigrationProject): boolean => {
  if (migration.scope === 'always' || lastUpgraded === undefined) {
    return true;
  }

  const [last, since] = [versionOf(lastUpgraded), versionOf(migration.since)];

  return !last || !since || compareVersions(last, since) < 0;
};

/** `text` with `edits` made, from the last back so each offset still means what the finder read. */
const applyEdits = (text: string, edits: readonly MigrationEdit[], migration: string, file: string): string => {
  const ordered = [...edits].sort((a, b) => b.start - a.start);
  for (const [index, edit] of ordered.entries()) {
    if (edit.start > edit.end || (index > 0 && edit.end > ordered[index - 1].start)) {
      throw new Error(`Migration ${migration} asked for overlapping edits in ${file}: that file was left as it was`);
    }
  }

  return ordered.reduce((written, edit) => written.slice(0, edit.start) + edit.text + written.slice(edit.end), text);
};

/**
 * Every place the migrations due in the project find in its source, in their order — each reading what the ones before
 * it wrote. With `write`, each place with one right answer (its `edit`) is written; any other is only said.
 */
export const runMigrations = async (
  project: MigrationProject,
  migrations: readonly Migration[],
  { write }: { write: boolean }
): Promise<MigrationFinding[]> => {
  const due = migrations
    .filter(migration => isDue(migration, project))
    .map(migration => ({ migration, find: migration.start(project) }));
  const findings: MigrationFinding[] = [];
  for (const file of await sourceFiles(project.root)) {
    const original = await fs.readFile(path.join(project.root, file), 'utf-8').catch(() => undefined);
    if (original === undefined) {
      continue;
    }

    let text = original;
    for (const { migration, find } of due) {
      const places = await find({ file, text });
      if (write) {
        text = applyEdits(
          text,
          places.flatMap(place => (place.edit ? [place.edit] : [])),
          migration.id,
          file
        );
      }

      findings.push(
        ...places.map(({ edit, ...place }) => ({
          ...place,
          migration: migration.id,
          since: migration.since,
          file,
          writable: edit !== undefined,
          written: write && edit !== undefined
        }))
      );
    }

    if (text !== original) {
      await fs.writeFile(path.join(project.root, file), text);
    }
  }

  return findings;
};
