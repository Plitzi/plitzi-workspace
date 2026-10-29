import { liveFindings } from './index';
import { shellWord } from '../../commands/shared/terminal';
import { refusedAgain } from '../agents/refusedAgain';
import { unansweredLines } from '../copies/unansweredLines';
import { readUsage } from '../core/usage';
import { saidOfPlitzi } from '../report/experience';
import { settledFindings } from '../report/settled';
import { readTaskReports } from '../report/taskReports';
import { noticesByOwner } from '../talk/notices';

import type { readRunLog } from '../run';
import type { LoadedRun } from '../run';
import type { Finding } from './types';
import type { Attention } from '../view/view';

/**
 * What the run's records show going wrong now — a task refused again and again, a line failing try after try, a prompt
 * three agents found wrong, an agent holding two tasks — as the lead's attention while the run goes: each said once
 * (its subject), and every one kept for the report too. What is past leaves it — a task gone to review or approved, a
 * line that passed since — and what is Plitzi's is the run's feedback's, never the lead's to clear: a run ended
 * with ten of them standing, which read as ignored.
 */
/** What the run's records raise now, read as `run watch` reads them: its log, its usage, what its agents said of Plitzi. */
export const runLiveFindings = async (
  loaded: LoadedRun,
  log: Awaited<ReturnType<typeof readRunLog>>
): Promise<Finding[]> =>
  liveFindings({
    log,
    usage: readUsage(loaded.paths.dir),
    // Frictions said at a complete as much as notices: two agents saying one thing is said while it can be acted on.
    said: saidOfPlitzi((await noticesByOwner(loaded)).plitzi, await readTaskReports(loaded))
  });

export const liveAttention = async (
  loaded: LoadedRun,
  log: Awaited<ReturnType<typeof readRunLog>>,
  now: Date,
  settled: ReadonlySet<string>
): Promise<Attention[]> => {
  const lastCheck = new Map<string, boolean>();
  for (const entry of log) {
    if (entry.action === 'check' && typeof entry.task === 'string') {
      lastCheck.set(entry.task, entry.ok === true);
    }
  }

  const past = (task: string | undefined): boolean =>
    task !== undefined && (settled.has(task) || lastCheck.get(task) === true);
  // What the lead said it did about one (`run settle`): settled by its word, never by a task it holds none of.
  const told = settledFindings(log);

  return [
    ...refusedAgain(log, now).filter(item => !past(item.task)),
    ...unansweredLines(log),
    ...(await runLiveFindings(loaded, log))
      .filter(finding => finding.owner !== 'plitzi' && !past(finding.task) && !told.has(finding.subject))
      .map((finding): Attention => ({
        kind: 'finding',
        subject: finding.subject,
        ...(finding.task ? { task: finding.task } : {}),
        text: `${finding.title}${finding.fix ? ` — ${finding.fix}` : ''} · once handled: plitzi run settle ${shellWord(finding.subject)} --note "what you did"`,
        who: 'lead'
      }))
  ];
};
