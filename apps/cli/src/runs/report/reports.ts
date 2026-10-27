import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { RUN_REPORTS_DIR } from '../../scaffold/paths';

/**
 * A run's reports, kept in the project as it ends (`.plitzi/plitzi-reports/runs/<run>/`) and committed with it: what its
 * team reads again, and the one folder a developer sends to Plitzi's team — so nothing in it may hold what is the
 * person's machine's, and everything a fix of Plitzi needs is in it, the run long gone.
 *
 * - `feedback.md` — what of the run is Plitzi's, to read first (`feedback.ts`).
 * - `report.md` — the run's report, whole; `report.json` the same as data (`version`ed): what `run report --bench` and the
 *   estimates of the next plans read.
 * - `records/` — the run's own records, as it kept them: its plan, log, usage, messages, each task's definition, state,
 *   rounds and reviews — what the report is computed from, to compute it again. Never the project's files.
 * - `scratch/` — the scripts the agents wrote for themselves: what each did that no command could.
 */

/** What `report.json` is shaped as: what reads it across runs and projects knows which it reads. */
export const REPORT_VERSION = 1;

export const runReportDir = (root: string, runId: string): string => path.join(root, RUN_REPORTS_DIR, runId);

export const REPORT_FILES = {
  feedback: 'feedback.md',
  report: 'report.md',
  data: 'report.json',
  records: 'records',
  scratch: 'scratch'
} as const;

/** A run token — `<run>.<agent>.<secret>` — as it is written: its secret is what is cut. */
const TOKEN = /\b[\w-]+\.(?:@[\w-]+|t-[\w-]+)\.[0-9a-f]{16,}\b/g;

/**
 * A text with the person's machine left out: the project's folder and their home said as such, a token's secret cut —
 * as a path is written in a text and as JSON writes it (`\\` on Windows).
 */
export const withoutMachine = (root: string, text: string): string => {
  let clean = text;
  for (const [from, to] of [
    [root, '<project>'],
    [os.homedir(), '~']
  ]) {
    clean = clean.replaceAll(from, to).replaceAll(JSON.stringify(from).slice(1, -1), to);
  }

  return clean.replace(TOKEN, '<token>');
};

/** A run's report as kept, read back: its id, when it ended, and its data — `bench` and `report` as each reader checks them. */
export interface KeptReport {
  runId: string;
  at: string;
  data: Record<string, unknown>;
}

/** Every run report the project keeps, oldest first: one whose `report.json` cannot be read is no run of the list. */
export const readRunReports = async (root: string): Promise<KeptReport[]> => {
  const dir = path.join(root, RUN_REPORTS_DIR);
  const runs = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const kept = await Promise.all(
    runs
      .filter(entry => entry.isDirectory())
      .map(async (entry): Promise<KeptReport[]> => {
        const read: unknown = await fs
          .readFile(path.join(dir, entry.name, REPORT_FILES.data), 'utf-8')
          .then(text => JSON.parse(text) as unknown)
          .catch(() => undefined);

        return isRecord(read) && isRecord(read.report) && typeof read.report.at === 'string'
          ? [{ runId: entry.name, at: read.report.at, data: read }]
          : [];
      })
  );

  return kept.flat().sort((a, b) => a.at.localeCompare(b.at));
};

/** What of a run's folder is no record of it: the project's files as it kept them, its pictures, who held which token. */
const NOT_RECORDS = new Set(['blobs', 'shots', 'reference', 'scratch', 'identities', 'locks']);

/** What of a folder's files is no record: a lock held, and a token's fingerprints. */
const isRecordFile = (name: string): boolean =>
  !name.endsWith('.lock') && name !== 'owner.json' && name !== 'revoked.json';

/**
 * The run's records, copied into `into` as the run keeps them, the person's machine left out of each: everything but
 * what `NOT_RECORDS` names — and of a `cache/`, its own files alone (a task's log and progress), never the copies under it.
 */
export const keepRecords = async (
  root: string,
  runDir: string,
  into: string
): Promise<{ files: number; bytes: number }> => {
  let files = 0;
  let bytes = 0;
  const copy = async (from: string, to: string, filesOnly: boolean): Promise<void> => {
    for (const entry of await fs.readdir(from, { withFileTypes: true }).catch(() => [])) {
      if (entry.isDirectory() && !filesOnly && !NOT_RECORDS.has(entry.name)) {
        await copy(path.join(from, entry.name), path.join(to, entry.name), entry.name === 'cache');
      } else if (entry.isFile() && isRecordFile(entry.name)) {
        const text = withoutMachine(root, await fs.readFile(path.join(from, entry.name), 'utf-8'));
        await fs.mkdir(to, { recursive: true });
        await fs.writeFile(path.join(to, entry.name), text);
        files += 1;
        bytes += Buffer.byteLength(text);
      }
    }
  };
  await copy(runDir, into, false);

  return { files, bytes };
};
