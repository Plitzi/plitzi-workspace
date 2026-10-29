import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { writeFeedback } from './feedback';
import { nestedHeadings, readSummary, SUMMARY_HEADING } from './report';
import { REPORT_FILES, runReportDir, withoutMachine } from './reports';
import { RUN_REPORTS_DIR } from '../../scaffold/paths';
import { isPrincipal } from '../agents/leads';
import { writeAtomic } from '../core/files';
import { RunRefusal } from '../core/refusal';
import { loadKeptRun, logRun, readRunLog } from '../run';

import type { LoadedRun, RunContext } from '../run';

/**
 * A run finished and applied, amended by its lead as it reads the report: a notice added — of the project's, or of
 * Plitzi's — one withdrawn, its summary written again. Written into the records the report keeps, each amendment with
 * when and by whom, and the report's three files written again from them: the feedback whole, the report and its data
 * with what was amended. A run's lead found three things after `--apply` and wrote them by hand into its feedback,
 * which neither `report.md` nor `report.json` carried — nothing official could add to a finished run.
 */

/** The log's action an amendment is kept as: what it did, in a line. */
export const AMENDED = 'amended-after-finish';

/** An amendment of a finished run, as its report says it. */
export interface Amendment {
  at: string;
  by: string;
  said: string;
}

/** The amendments a run's log holds, oldest first. */
export const amendmentsOf = (log: readonly Record<string, unknown>[]): Amendment[] =>
  log.flatMap(entry =>
    entry.action === AMENDED && typeof entry.at === 'string' && typeof entry.said === 'string'
      ? [{ at: entry.at, by: typeof entry.by === 'string' ? entry.by : 'someone', said: entry.said }]
      : []
  );

/** The report's own section of its amendments: written again whole each time. */
const AMENDED_HEADING = '## Amended after the finish';

/** `report.md` with the lead's summary written again in its place, every other section as it was. */
export const withSummary = (report: string, summary: string): string => {
  const at = report.indexOf(`${SUMMARY_HEADING}\n`);
  if (at === -1) {
    return report;
  }

  const body = at + SUMMARY_HEADING.length + 1;
  const next = report.indexOf('\n## ', body);

  return `${report.slice(0, body)}\n${nestedHeadings(summary.trim())}\n${next === -1 ? '\n' : report.slice(next)}`;
};

/** `report.md` with its amendments said last — the section written again, never twice. */
export const withAmendments = (report: string, amendments: readonly Amendment[]): string => {
  const at = report.indexOf(`\n${AMENDED_HEADING}\n`);
  const before = (at === -1 ? report : report.slice(0, at)).trimEnd();

  return amendments.length === 0
    ? `${before}\n`
    : [
        before,
        '',
        AMENDED_HEADING,
        '',
        ...amendments.map(each => `- ${each.at.slice(0, 16).replace('T', ' ')} UTC, ${each.by}: ${each.said}`),
        ''
      ].join('\n');
};

/**
 * Amends a finished run: `change` writes into its kept records and says what it did, in a line; the feedback is written
 * again from them, and the report and its data say the amendment. Its lead's alone, or its person's.
 */
export const amendKeptRun = async (
  ctx: RunContext,
  runId: string,
  change: (kept: LoadedRun) => Promise<string>
): Promise<{ said: string; dir: string }> => {
  const kept = await loadKeptRun(ctx.root, runId);
  if (!kept) {
    throw new RunRefusal(
      'not-found',
      `This project keeps no report of a run "${runId}" (${RUN_REPORTS_DIR}/): a run is amended after its finish from its report's records`,
      { run: runId }
    );
  }

  if (!isPrincipal(ctx.agent)) {
    throw new RunRefusal('invalid', `Run "${runId}" is over: its lead, or its person, amends it — not ${ctx.agent}`);
  }

  const said = await change(kept);
  await logRun(ctx, kept.paths, { action: AMENDED, said });
  const amendments = amendmentsOf(await readRunLog(kept.paths));
  const dir = runReportDir(ctx.root, runId);
  await writeFeedback(ctx, kept);
  const report = path.join(dir, REPORT_FILES.report);
  const text = await fs.readFile(report, 'utf-8').catch(() => undefined);
  const summary = await readSummary(kept);
  if (text !== undefined) {
    const summed = summary === undefined ? text : withSummary(text, summary);
    await writeAtomic(report, withoutMachine(ctx.root, withAmendments(summed, amendments)));
  }

  const data = path.join(dir, REPORT_FILES.data);
  const read: unknown = await fs
    .readFile(data, 'utf-8')
    .then(json => JSON.parse(json) as unknown)
    .catch(() => undefined);
  if (isRecord(read)) {
    await writeAtomic(
      data,
      withoutMachine(
        ctx.root,
        `${JSON.stringify({ ...read, ...(summary === undefined ? {} : { summary }), amendments }, null, 2)}\n`
      )
    );
  }

  return { said, dir };
};
