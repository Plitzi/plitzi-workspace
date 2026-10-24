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
 * (its subject), and every one kept for the report too.
 */
export const liveAttention = async (
  loaded: LoadedRun,
  log: Awaited<ReturnType<typeof readRunLog>>,
  now: Date
): Promise<Attention[]> => [
  ...refusedAgain(log, now),
  ...liveFindings({
    log,
    usage: readUsage(loaded.paths.dir),
    // Frictions said at a complete as much as notices: two agents saying one thing is said while it can be acted on.
    said: saidOfPlitzi((await noticesByOwner(loaded)).plitzi, await readTaskReports(loaded))
  }).map((finding): Attention => ({
    kind: 'finding',
    subject: finding.subject,
    text: `${finding.title}${finding.fix ? ` — ${finding.fix}` : ''}${finding.owner === 'plitzi' ? ' (Plitzi’s: the run’s feedback carries it)' : ''}`,
    who: 'lead'
  }))
];
