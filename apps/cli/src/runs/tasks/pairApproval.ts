import { designDue } from '../design';
import { exists, fingerprint, writeJson } from '../files';
import { assertReviewingLead } from '../leads';
import { LEAD, messagesOf } from '../messages';
import { under } from '../paths';
import { RunRefusal } from '../refusal';
import { keepFiles } from '../store';
import { readRequests, readStart, viewTask } from '../taskStore';
import { at, changedInCopy, findTask } from './common';

import type { ReviewComment, TaskStart } from '../model';
import type { LoadedRun, RunContext } from '../run';
import type { TaskView } from '../taskStore';

/**
 * Two tasks in review approved as one change (`task review A --approve --with B`): each reads a file the other makes —
 * an agreed import, a module moved — so neither passes the project's checks without the other, and one at a time they
 * never could be approved (a run's t-crate-api and t-follow-api, each importing the other's new file).
 */

/** The files its copy holds otherwise than it went to review — changed again, or changed for the first time since. */
export const writtenSince = async (
  view: TaskView,
  start: TaskStart,
  submitted: Readonly<Record<string, string | null>>
): Promise<string[]> => {
  if (!(await exists(view.paths.work))) {
    return [];
  }

  // A file it asked another to change went with it as the request's version: it counts as submitted at that one.
  const asked = Object.fromEntries((await readRequests(view.paths)).map(request => [request.file, request.wanted]));
  const sent = { ...asked, ...submitted };
  const late = new Set((await changedInCopy(view, start)).filter(file => !Object.hasOwn(sent, file)));
  for (const [file, digest] of Object.entries(sent)) {
    if ((await fingerprint(under(view.paths.work, file))) !== digest) {
      late.add(file);
    }
  }

  return [...late].sort();
};

/** The task approved beside another, read as its own approval reads it: what went to review, where its copy started. */
export interface Partner {
  view: TaskView;
  start: TaskStart;
  submitted: Record<string, string | null>;
  round: number;
  notReviewed: string[];
}

/**
 * The task named by `--with`, ready to go in beside `taskId` — or refused, naming what it lacks: in review, its UI
 * review said, its questions answered, and nothing asked of shared files (each of those goes in through its own
 * approval). Nothing is written until both are in.
 */
export const partnerFor = async (
  ctx: RunContext,
  loaded: LoadedRun,
  taskId: string,
  withId: string
): Promise<Partner> => {
  const task = findTask(loaded, withId);
  if (task.id === taskId) {
    throw new RunRefusal('invalid', `--with names another task in review, not ${taskId} itself`, { task: taskId });
  }

  const view = await viewTask(loaded.paths, task);
  await assertReviewingLead(ctx, view);
  const alone = `approve ${withId} on its own, or send it back (plitzi task review ${withId} --changes "…")`;
  if (view.state.status !== 'in-review') {
    throw new RunRefusal('invalid', `--with ${withId}: it is ${view.state.status}, not in review`, { task: withId });
  }

  if (designDue(view.state)) {
    throw new RunRefusal(
      'invalid',
      `--with ${withId}: its UI waits for its review — have it said first (or ${alone})`,
      { task: withId }
    );
  }

  const answered = new Set((await messagesOf(loaded)).flatMap(message => (message.replyTo ? [message.replyTo] : [])));
  const open = (await messagesOf(loaded)).filter(
    message => message.from === withId && message.to === LEAD && !message.fyi && !answered.has(message.id)
  );
  if (open.length > 0) {
    throw new RunRefusal(
      'invalid',
      `--with ${withId}: it asked ${open.map(message => message.id).join(', ')} and it is not answered — answer it first`,
      { task: withId, questions: open.map(message => message.id) }
    );
  }

  if ((await readRequests(view.paths)).some(request => !(view.state.changed ?? []).includes(request.file))) {
    throw new RunRefusal(
      'invalid',
      `--with ${withId}: it asks changes of shared files, which go in through its own approval — ${alone}`,
      { task: withId }
    );
  }

  const start = await readStart(view.paths);
  if (!start) {
    throw new RunRefusal(
      'invalid',
      `--with ${withId}: its copy is gone — reassign it (plitzi task reassign ${withId})`
    );
  }

  const submitted = view.state.submitted ?? (await keepFiles(loaded.paths, view.paths.work, view.state.changed ?? []));

  return {
    view,
    start,
    submitted,
    round: view.state.round + 1,
    notReviewed: await writtenSince(view, start, submitted)
  };
};

/** Its review said, as an approval beside `taskId`: what went in, once it went in. */
export const reviewedBeside = async (
  ctx: RunContext,
  partner: Partner,
  taskId: string,
  comments: readonly ReviewComment[]
): Promise<void> => {
  const { view, round, submitted } = partner;
  await writeJson(view.paths.reviewed, { round, at: at(ctx), files: submitted });
  await writeJson(view.paths.review, { round, verdict: 'approve', comments, by: ctx.agent, at: at(ctx), with: taskId });
};

/**
 * What a failed approval says of the tasks in review beside it: one may make what it reads — approved together, they
 * go in as one change.
 */
export const besideHint = async (loaded: LoadedRun, taskId: string, partner: Partner | undefined): Promise<string> => {
  if (partner) {
    return '';
  }

  const reviewing: string[] = [];
  for (const task of loaded.tasks.filter(each => each.id !== taskId)) {
    if ((await viewTask(loaded.paths, task)).state.status === 'in-review') {
      reviewing.push(task.id);
    }
  }

  return reviewing.length > 0
    ? `. If it reads a file a task in review makes (${reviewing.join(', ')}), approve the two as one change: plitzi task review ${taskId} --approve --with <that task>`
    : '';
};
