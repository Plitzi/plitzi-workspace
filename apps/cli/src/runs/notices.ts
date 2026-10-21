import { isCoLead, isPrincipal } from './leads';
import { LEAD, sendMessage } from './messages';
import { RunRefusal } from './refusal';
import { assertStatus, loadRun, logRun, readRunLog } from './run';
import { findTask, holderOf } from './tasks';
import { readTeam, startedAgents } from './team';

import type { LoadedRun, RunContext } from './run';

/**
 * `plitzi run notice`: something wrong seen while working that no task owns — outside the task in hand, there before
 * the run, nobody's to fix in this one. Kept in the run's log, said by the finish and listed in the report, where the
 * next stage or run is planned from: la-velada's empty stats cell was seen in two runs, noted "predates this task" in
 * a review each time, and left.
 */
export interface Notice {
  at: string;
  by: string;
  text: string;
  /** Where it is: a page, an element, a file. */
  on?: string;
  /** The task its agent was at when it saw it. */
  task?: string;
}

export const noticeRun = async (
  ctx: RunContext,
  runId: string,
  text: string,
  { task, on }: { task?: string; on?: string } = {}
): Promise<Notice> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping', 'reconciliation'], 'notice something');
  if (text.trim() === '') {
    throw new RunRefusal('invalid', 'Say what is wrong and where: plitzi run notice "…" --on <page, element or file>');
  }

  if (task !== undefined) {
    await holderOf(ctx, loaded, findTask(loaded, task));
  } else if (!isPrincipal(ctx.agent) && !isCoLead(loaded.record, ctx.agent)) {
    const team = await readTeam(ctx.root).catch(() => undefined);
    if (!(team ? startedAgents(team) : []).some(member => member.agent === ctx.agent)) {
      throw new RunRefusal(
        'invalid',
        `${ctx.agent} is no agent of the team: an agent notices as itself (--agent <its name>), a task's holder with its token`
      );
    }
  }

  const notice: Notice = {
    at: ctx.now().toISOString(),
    by: ctx.agent,
    text: text.trim(),
    ...(on ? { on } : {}),
    ...(task ? { task } : {})
  };
  await logRun(ctx, loaded.paths, {
    action: 'notice',
    text: notice.text,
    ...(on ? { on } : {}),
    ...(task ? { task } : {})
  });
  // An agent's reaches the lead too: it plans the next stage, and hears it now rather than at the finish.
  if (!isPrincipal(ctx.agent) && !isCoLead(loaded.record, ctx.agent)) {
    await sendMessage(ctx, loaded, {
      from: task ?? ctx.agent,
      to: LEAD,
      text: `Noticed, owned by no task: ${noticeText(notice)}`,
      fyi: true
    });
  }

  return notice;
};

/** Every notice of the run, read off its log, oldest first. */
export const noticesOf = async (loaded: LoadedRun): Promise<Notice[]> =>
  (await readRunLog(loaded.paths)).flatMap(entry =>
    entry.action === 'notice' && typeof entry.text === 'string' && typeof entry.at === 'string'
      ? [
          {
            at: entry.at,
            by: typeof entry.by === 'string' ? entry.by : 'someone',
            text: entry.text,
            ...(typeof entry.on === 'string' ? { on: entry.on } : {}),
            ...(typeof entry.task === 'string' ? { task: entry.task } : {})
          }
        ]
      : []
  );

/** A notice in a line: what, where, who — and at which task. */
export const noticeText = (notice: Notice): string =>
  `${notice.text}${notice.on ? ` (on ${notice.on})` : ''} — ${notice.by}${notice.task ? `, at ${notice.task}` : ''}`;
