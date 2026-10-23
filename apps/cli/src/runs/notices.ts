import { isCoLead, isPrincipal } from './leads';
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
  /**
   * `plitzi`: of Plitzi itself — the CLI, the platform, its docs — not of the project: never the project's backlog, the
   * run's feedback to Plitzi carries it (`feedback.ts`).
   */
  about?: 'plitzi';
}

export const noticeRun = async (
  ctx: RunContext,
  runId: string,
  text: string,
  { task, on, plitzi = false }: { task?: string; on?: string; plitzi?: boolean } = {}
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
        `${ctx.agent} is no agent of the team: an agent notices as itself, with its own token (--token), a task's holder with its token`
      );
    }
  }

  const notice: Notice = {
    at: ctx.now().toISOString(),
    by: ctx.agent,
    text: text.trim(),
    ...(on ? { on } : {}),
    ...(task ? { task } : {}),
    ...(plitzi ? { about: 'plitzi' as const } : {})
  };
  await logRun(ctx, loaded.paths, {
    action: 'notice',
    text: notice.text,
    ...(on ? { on } : {}),
    ...(task ? { task } : {}),
    ...(plitzi ? { about: 'plitzi' } : {})
  });
  // Never sent to the lead as a message: it is for the next stage, not for now, and each woke the lead that waits on the
  // run for what needs it (velada-now: two designers' notices, two wake-ups with nothing to do). The activity shows it,
  // the finish says it and the report lists it.
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
            ...(typeof entry.task === 'string' ? { task: entry.task } : {}),
            ...(entry.about === 'plitzi' ? { about: 'plitzi' as const } : {})
          }
        ]
      : []
  );

/**
 * A run's notices, by whose they are: the project's — what the next stage starts from — and Plitzi's, which the run's
 * feedback carries (lx-controls' dry finish listed what agents said of the CLI as the project's next stage).
 */
export const noticesByOwner = async (loaded: LoadedRun): Promise<{ project: Notice[]; plitzi: Notice[] }> => {
  const all = await noticesOf(loaded);

  return {
    project: all.filter(notice => notice.about !== 'plitzi'),
    plitzi: all.filter(notice => notice.about === 'plitzi')
  };
};

/** A notice in a line: what, where, who — and at which task. */
export const noticeText = (notice: Notice): string =>
  `${notice.text}${notice.on ? ` (on ${notice.on})` : ''} — ${notice.by}${notice.task ? `, at ${notice.task}` : ''}`;
