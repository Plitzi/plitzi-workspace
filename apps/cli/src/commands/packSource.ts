import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { sayDryRun } from './dryRun';
import { findProject } from './existingProject';
import { fail } from './terminal';
import { packSource } from '../pack/source';

import type { DryRunOptions } from './dryRun';
import type { SourceSnapshotKind } from '@plitzi/sdk-shared/source';

export interface PackSourceOptions extends DryRunOptions {
  kind: SourceSnapshotKind;
  name: string;
  /** The project the paths are relative to: the nearest package.json's folder unless named. */
  root?: string;
  out: string;
}

/**
 * `plitzi source pack`: the snapshot `plitzi plugin upload` and `plitzi runtime push` keep beside what they send (RFC
 * 0020), written to a file — to see what of a project would be kept, or for a tool that keeps it itself (the seeder).
 */
const packSourceCommand = async (entries: string[], options: PackSourceOptions): Promise<void> => {
  const root = options.root ? path.resolve(options.root) : (await findProject(process.cwd()))?.root;
  if (!root) {
    fail('plitzi source pack packs a project’s source, and there is no package.json here or above.');

    return;
  }

  try {
    const { snapshot, bytes } = await packSource({
      root,
      kind: options.kind,
      name: options.name,
      entries: entries.map(entry => path.resolve(entry))
    });
    const out = path.resolve(options.out);
    if (options.dryRun) {
      sayDryRun(`plitzi source — ${options.name}`, [
        `+ ${path.relative(process.cwd(), out)} (${(bytes.byteLength / 1024).toFixed(0)} KB) — the source snapshot of:`,
        ...Object.keys(snapshot.files)
          .sort()
          .map(file => `    ${file}`)
      ]);

      return;
    }

    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, bytes);
    console.log(
      chalk.green(`${options.name}: ${String(Object.keys(snapshot.files).length)} files`) +
        chalk.dim(` — ${path.relative(process.cwd(), out)} (${(bytes.byteLength / 1024).toFixed(0)} KB)`)
    );
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
};

export default packSourceCommand;
