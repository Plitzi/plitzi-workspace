import { folderImports } from './changes/folderImports';
import { livePagesOption } from './changes/livePagesOption';
import { movedExports } from './changes/movedExports';

import type { Migration } from './types';

export { runMigrations } from './run';
export type { Migration, MigrationEdit, MigrationFinding, MigrationPlace, MigrationProject, SourceFile } from './types';

/**
 * What `plitzi upgrade migrations` looks for in a project's own source, oldest first: each runs on what the ones before
 * it wrote.
 *
 * One file each in `changes/`, and nothing else there; this folder holds the machinery (`types.ts`, `run.ts`) and the
 * template. A release that changes something a project's source may count on adds one: a copy of `template.ts` in
 * `changes/` named by what it changes, its `since` the version it ships in, listed below in order, with a copy of
 * `template.test.ts` beside it. One
 * stays as long as a project may still be on a version before it; removing it is a decision, said in the changeset.
 */
export const MIGRATIONS: readonly Migration[] = [folderImports, movedExports, livePagesOption];
