import { isPrincipal } from '../agents/leads';
import { readTeam, startedAgents } from '../agents/team';
import { RunRefusal } from '../core/refusal';
import { isPlitziHow } from '../findings/plitziClass';
import { assertStatus, loadRun, logRun, readRunLog } from '../run';
import { findTask, holderOf } from '../tasks';

import type { PlitziHow } from '../findings/plitziClass';
import type { LoadedRun, RunContext } from '../run';

/**
 * `plitzi run notice`: something wrong seen while working that no task owns — outside the task in hand, there before
 * the run, nobody's to fix in this one. Kept in the run's log, said by the finish and listed in the report, where the
 * next stage or run is planned from: a run's empty stats cell was seen in two runs, noted "predates this task" in
 * a review each time, and left.
 */
export interface Notice {
  /** Its name in the run, by its place among the run's notices — `n3` — what withdraws it (`withdrawNotice`). */
  id: string;
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
  /** Of Plitzi's, what it was, as whoever noticed it placed it (`run notice --plitzi <how>`). */
  how?: PlitziHow;
}

export const noticeRun = async (
  ctx: RunContext,
  runId: string,
  text: string,
  { task, on, plitzi }: { task?: string; on?: string; plitzi?: PlitziHow } = {}
): Promise<Notice> => {
  // Any version: what is wrong is said while it is — a Plitzi changed under the run among it (refused 13).
  const loaded = await loadRun(ctx, runId, { anyVersion: true });
  assertStatus(loaded, ['open', 'stopping', 'reconciliation'], 'notice something');
  if (text.trim() === '') {
    throw new RunRefusal('invalid', 'Say what is wrong and where: plitzi run notice "…" --on <page, element or file>');
  }

  if (task !== undefined) {
    await holderOf(ctx, loaded, findTask(loaded, task));
  } else if (!isPrincipal(ctx.agent)) {
    const team = await readTeam(ctx.root).catch(() => undefined);
    if (!(team ? startedAgents(team) : []).some(member => member.agent === ctx.agent)) {
      throw new RunRefusal(
        'invalid',
        `${ctx.agent} is no agent of the team: an agent notices as itself, with its own token (--token), a task's holder with its token`
      );
    }
  }

  // Never sent to the lead as a message: it is for the next stage, not for now, and each woke the lead that waits on the
  // run for what needs it (two designers' notices, two wake-ups with nothing to do). The activity shows it,
  // the finish says it and the report lists it.
  return logNotice(ctx, loaded, text, {
    ...(task ? { task } : {}),
    ...(on ? { on } : {}),
    ...(plitzi ? { plitzi } : {})
  });
};

/** A notice written into a run's log — open, or finished and amended (`amend.ts`) — under the next name. */
export const logNotice = async (
  ctx: RunContext,
  loaded: LoadedRun,
  text: string,
  { task, on, plitzi }: { task?: string; on?: string; plitzi?: PlitziHow } = {}
): Promise<Notice> => {
  if (text.trim() === '') {
    throw new RunRefusal('invalid', 'Say what is wrong and where: plitzi run notice "…" --on <page, element or file>');
  }

  const notice: Notice = {
    id: `n${String(noticesIn(await readRunLog(loaded.paths)).length + 1)}`,
    at: ctx.now().toISOString(),
    by: ctx.agent,
    text: text.trim(),
    ...(on ? { on } : {}),
    ...(task ? { task } : {}),
    ...(plitzi ? { about: 'plitzi' as const, how: plitzi } : {})
  };
  await logRun(ctx, loaded.paths, {
    action: 'notice',
    text: notice.text,
    ...(on ? { on } : {}),
    ...(task ? { task } : {}),
    ...(plitzi ? { about: 'plitzi', how: plitzi } : {})
  });

  return notice;
};

/** The log's action that withdraws a notice: the notice stays in the log, said withdrawn and why, out of every report. */
export const NOTICE_WITHDRAWN = 'notice-withdrawn';

/** Every notice a log holds, withdrawn or not, each named by its place: `n1`, `n2`… */
const noticesIn = (log: readonly Record<string, unknown>[]): Notice[] =>
  log
    .filter(entry => entry.action === 'notice' && typeof entry.text === 'string' && typeof entry.at === 'string')
    .flatMap((entry, index) =>
      typeof entry.text === 'string' && typeof entry.at === 'string'
        ? [
            {
              id: `n${String(index + 1)}`,
              at: entry.at,
              by: typeof entry.by === 'string' ? entry.by : 'someone',
              text: entry.text,
              ...(typeof entry.on === 'string' ? { on: entry.on } : {}),
              ...(typeof entry.task === 'string' ? { task: entry.task } : {}),
              ...(entry.about === 'plitzi' ? { about: 'plitzi' as const } : {}),
              ...(isPlitziHow(entry.how) ? { how: entry.how } : {})
            }
          ]
        : []
    );

/** The notices withdrawn, by id: what each was withdrawn for, and by whom. */
const withdrawnIn = (log: readonly Record<string, unknown>[]): Map<string, { why: string; by: string }> =>
  new Map(
    log.flatMap(entry =>
      entry.action === NOTICE_WITHDRAWN && typeof entry.notice === 'string' && typeof entry.why === 'string'
        ? [[entry.notice, { why: entry.why, by: typeof entry.by === 'string' ? entry.by : 'someone' }] as const]
        : []
    )
  );

/** Every notice of the run, read off its log, oldest first — those withdrawn left out (`withdrawNotice`). */
export const noticesOf = async (loaded: LoadedRun): Promise<Notice[]> => {
  const log = await readRunLog(loaded.paths);
  const withdrawn = withdrawnIn(log);

  return noticesIn(log).filter(notice => !withdrawn.has(notice.id));
};

/**
 * `plitzi run notice --withdraw <id> "why"`: a notice filed by mistake, or of another's — kept in the log as withdrawn,
 * with why, and out of the finish, the report and the feedback to Plitzi. The lead withdraws any; an agent its own. A
 * run's lead filed one of the experiment's own setup, Carlos said to leave it out, and nothing could.
 */
export const withdrawNotice = async (ctx: RunContext, loaded: LoadedRun, id: string, why: string): Promise<Notice> => {
  if (why.trim() === '') {
    throw new RunRefusal('invalid', `Say why it is withdrawn: plitzi run notice --withdraw ${id} "why"`);
  }

  const log = await readRunLog(loaded.paths);
  const all = noticesIn(log);
  const notice = all.find(each => each.id === id);
  if (!notice) {
    throw new RunRefusal(
      'not-found',
      `The run has no notice ${id}: ${all.length === 0 ? 'it has none' : `its notices are n1 to n${String(all.length)} (plitzi run status lists them)`}`
    );
  }

  const withdrawn = withdrawnIn(log).get(id);
  if (withdrawn) {
    throw new RunRefusal('invalid', `Notice ${id} is withdrawn already, by ${withdrawn.by}: ${withdrawn.why}`);
  }

  if (!isPrincipal(ctx.agent) && notice.by !== ctx.agent) {
    throw new RunRefusal('invalid', `Notice ${id} is ${notice.by}'s: an agent withdraws its own, the lead any`);
  }

  await logRun(ctx, loaded.paths, { action: NOTICE_WITHDRAWN, notice: id, why: why.trim() });

  return notice;
};

/**
 * A run's notices, by whose they are: the project's — what the next stage starts from — and Plitzi's, which the run's
 * feedback carries (a run's dry finish listed what agents said of the CLI as the project's next stage).
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
  `${notice.id}: ${notice.text}${notice.on ? ` (on ${notice.on})` : ''} — ${notice.by}${notice.task ? `, at ${notice.task}` : ''}`;
