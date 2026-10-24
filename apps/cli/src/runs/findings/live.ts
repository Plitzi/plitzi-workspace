import { saidOfPlitzi } from '../experience';
import { noticesByOwner } from '../notices';
import { refusedAgain } from '../refusedAgain';
import { readTaskReports } from '../taskReports';
import { readUsage } from '../usage';
import { liveFindings } from './index';

import type { readRunLog } from '../run';
import type { LoadedRun } from '../run';
import type { Attention } from '../view';

/**
 * What the run's records show going wrong now — a task refused again and again, a line failing try after try, a prompt
 * three agents found wrong, an agent holding two tasks — as the lead's attention while the run goes: each said once
 * (its subject), and every one kept for the report too. What is past leaves it — a task gone to review or approved, a
 * line that passed since — and what is Plitzi's is the run's feedback's, never the lead's to clear: encore-2 ended
 * with ten of them standing, which read as ignored.
 */
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

  return [
    ...refusedAgain(log, now).filter(item => !past(item.task)),
    ...liveFindings({
      log,
      usage: readUsage(loaded.paths.dir),
      // Frictions said at a complete as much as notices: two agents saying one thing is said while it can be acted on.
      said: saidOfPlitzi((await noticesByOwner(loaded)).plitzi, await readTaskReports(loaded))
    })
      .filter(finding => finding.owner !== 'plitzi' && !past(finding.task))
      .map((finding): Attention => ({
        kind: 'finding',
        subject: finding.subject,
        ...(finding.task ? { task: finding.task } : {}),
        text: `${finding.title}${finding.fix ? ` — ${finding.fix}` : ''}`,
        who: 'lead'
      }))
  ];
};
