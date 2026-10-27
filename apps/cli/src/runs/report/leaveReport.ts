import fs from 'node:fs/promises';
import path from 'node:path';

import { benchOf, readBench } from './bench';
import { writeFeedback } from './feedback';
import { writeAtomic } from '../core/files';
import { keepScratch } from '../findings';
import { rememberPace } from './history';
import { buildReport, readSummary, reportText } from './report';
import { keepRecords, REPORT_FILES, REPORT_VERSION, runReportDir, withoutMachine } from './reports';

import type { Closing } from './report';
import type { LoadedRun, RunContext } from '../run';

/** What a run that ends leaves of itself in the project (`reports.ts`): where, and what its records came to. */
export interface LeftReport {
  dir: string;
  records: { files: number; bytes: number };
  /** The agents' scripts kept, and those left out as too large. */
  scratch: { kept: string[]; tooLarge: string[] };
}

/**
 * Leaves the reports of a run that ends in its folder — the report, its data, the feedback to Plitzi, the run's records
 * and the agents' scripts — before the run goes with everything it held. A run's folder written again (its feedback
 * written mid-run, `run report --plitzi`) is this run's: its records and scripts are this ending's alone.
 */
export const leaveReport = async (ctx: RunContext, loaded: LoadedRun, closing: Closing): Promise<LeftReport> => {
  const dir = runReportDir(ctx.root, loaded.record.runId);
  const clean = (text: string): string => withoutMachine(ctx.root, text);
  await fs.rm(path.join(dir, REPORT_FILES.records), { recursive: true, force: true });
  await fs.rm(path.join(dir, REPORT_FILES.scratch), { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  const report = await buildReport(ctx, loaded);
  const summary = await readSummary(loaded);
  const bench = benchOf(report, ctx.cli);
  const before = (await readBench(ctx.root)).filter(line => line.runId !== loaded.record.runId);
  await writeAtomic(
    path.join(dir, REPORT_FILES.report),
    clean(reportText(report, summary, closing, [...before.slice(-5), bench]))
  );
  const scratch = await keepScratch(loaded.paths.scratch, path.join(dir, REPORT_FILES.scratch), clean);
  // The lead's summary in it too: the data is the whole report, for what analyses runs side by side.
  await writeAtomic(
    path.join(dir, REPORT_FILES.data),
    clean(`${JSON.stringify({ version: REPORT_VERSION, bench, report, summary: summary ?? null, scratch }, null, 2)}\n`)
  );
  await writeFeedback(ctx, loaded);
  const records = await keepRecords(ctx.root, loaded.paths.dir, path.join(dir, REPORT_FILES.records));
  // This machine's pace too: what the next first run of any project scales its estimates by.
  await rememberPace(report.tasks);

  return { dir, records, scratch };
};
