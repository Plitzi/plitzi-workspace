import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { testsImporting } from './tests';
import { readOwnership } from '../../copies/ownership';
import { projectFiles } from '../../core/files';

/**
 * What imports what in the run's approved work, and which tests — what a stage's or an amendment's tasks reach of the
 * run's own (`stageImpact`). Reading it parses every module with TypeScript, so it is kept in the run's cache by what
 * the code is: a `--dry-run`, the stacking after it and an amend see the same approved work, and read it once.
 */

export interface RunGraph {
  /** Who imports each file, all of the approved work's (`Ownership.importedBy`). */
  importedBy: Map<string, string[]>;
  /** The test files that import each module (`testsImporting`). */
  tests: Map<string, string[]>;
}

/** What the graph is read from: the code and what says where it starts — never an image or a font. */
const READ = /\.(?:[cm]?[jt]sx?|json)$/;

/** The work's code, as one digest: the same code, the same graph. */
const digestOf = async (work: string): Promise<string> => {
  const hash = createHash('sha256');
  for (const file of (await projectFiles(work)).filter(each => READ.test(each)).sort()) {
    hash
      .update(file)
      .update('\0')
      .update(await fs.readFile(path.join(work, file)))
      .update('\0');
  }

  return hash.digest('hex');
};

const isEdges = (value: unknown): value is Record<string, string[]> =>
  isRecord(value) &&
  Object.values(value).every(each => Array.isArray(each) && each.every(item => typeof item === 'string'));

interface Kept {
  digest: string;
  importedBy: Record<string, string[]>;
  tests: Record<string, string[]>;
}

const isKept = (value: unknown): value is Kept =>
  isRecord(value) && typeof value.digest === 'string' && isEdges(value.importedBy) && isEdges(value.tests);

/** The approved work's graph, materialised at `work` — read again only when its code changed since it was kept. */
export const runGraph = async (cache: string, work: string): Promise<RunGraph> => {
  const file = path.join(cache, 'run-graph.json');
  const digest = await digestOf(work);
  const kept: unknown = await fs
    .readFile(file, 'utf-8')
    .then(text => JSON.parse(text) as unknown)
    .catch(() => undefined);
  if (isKept(kept) && kept.digest === digest) {
    return { importedBy: new Map(Object.entries(kept.importedBy)), tests: new Map(Object.entries(kept.tests)) };
  }

  const graph = { importedBy: (await readOwnership(work)).importedBy, tests: await testsImporting(work) };
  // A cache: one not written costs the next read its parse, nothing more — said nowhere, as nothing is lost.
  await fs.mkdir(cache, { recursive: true });
  await fs
    .writeFile(
      file,
      `${JSON.stringify({ digest, importedBy: Object.fromEntries(graph.importedBy), tests: Object.fromEntries(graph.tests) })}\n`
    )
    .catch(() => undefined);

  return graph;
};
