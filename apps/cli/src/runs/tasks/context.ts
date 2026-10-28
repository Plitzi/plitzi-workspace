import { currentVersion, findTask } from './common';
import { restrictionsOn } from './restrictions';
import { unifiedDiff } from '../../fix/diff';
import { PROJECT_NOTES } from '../../scaffold/paths';
import { readOptional } from '../core/files';
import { acceptanceText } from '../core/model';
import { under } from '../core/paths';
import { getBlob } from '../core/store';
import { readStart, viewTask } from '../core/taskStore';
import { readingFor } from '../plan/reading';
import { isResearch, roleOf } from '../plan/spike';
import { loadRun, readApproved } from '../run';
import { agreementsOf, proposalsOf } from '../talk/agreements';
import { runNotesOf } from '../talk/messages';

import type { ReviewComment, RunTask, TaskState } from '../core/model';
import type { TaskView } from '../core/taskStore';
import type { Finding } from '../plan/spike';
import type { LoadedRun, RunContext } from '../run';
import type { ProposalView } from '../talk/agreements';

/**
 * `plitzi task context`: the brief an agent starts from — what is asked, what was said and agreed, its files.
 */

export interface TaskContext {
  task: RunTask;
  state: TaskState;
  holder?: string;
  review?: { round: number; verdict: string; comments: ReviewComment[] };
  /** For an integration task: each request with the requester's version against the run's now. */
  requests: { task: string; file: string; summary: string; usedIn: string[]; diff?: string; notes: string[] }[];
  related: {
    task: string;
    title: string;
    status: string;
    changed: string[];
    notes: string[];
    /** A task it waits for: what it was asked, and what its reviews asked on top — what a tester writes its tests from. */
    asked?: { acceptance: string[]; reviews: string[] };
    /** What its spikes found out: research a task builds on, said where it is built. */
    findings?: Finding[];
  }[];
  /**
   * Its files the run approved a version of, when, and by which task: what a finding written before then may no longer
   * say right (a spike found 7 of 12 tones; by the time its task was taken the run had all 12).
   */
  approved: { file: string; task: string; at: string }[];
  contracts: { resource: string; owner: string; note: string }[];
  /** What it was proposed and proposed, and what it agreed to with other tasks — what its review checks too. */
  proposals: { incoming: ProposalView[]; outgoing: ProposalView[]; agreements: ProposalView[] };
  /** The project's own notes (`NOTES.md`): how something is built here, what must not be undone. */
  projectNotes?: string;
  /** The run's notes to every task (`task message all`, the plan's `notes`): what holds for the whole run. */
  runNotes: string[];
  /** The lead's primer for every task, when the plan has one: what the project is, read once instead of its skills. */
  primer?: string;
  /** The skill files this task reads first, by the files it writes — the rest when its work asks. */
  reading: string[];
  /**
   * Each of the task's files — from its copy while it holds one, else the run's — as text when it is text and small;
   * `toCreate`: one that does not exist yet, the task's to write.
   */
  files: { file: string; from: 'copy' | 'run'; text?: string; bytes?: number; toCreate?: boolean }[];
  /**
   * Where the rest of the project is read from for it — what its files import, the data's shapes: its copy while it
   * holds one. A run's tester read `formatCountdown` as the project had it before the run, its copy's being new.
   */
  sourceRoot: string;
  /**
   * Another task's files beside its own, by name — `shows.test.ts` of `shows.ts`, a tester's: a run's developers wrote
   * tests into a tests card's file and learnt it at `task check`, the writing lost.
   */
  neighbours: { file: string; task: string; role: string }[];
  /**
   * What the project's lint forbids in its files, with its config's words (`restrictionsOn`): known before `task check`
   * says it.
   */
  restrictions: string[];
}

/** A file's name with no extension nor `.test`/`.spec`: what a module and its tests share. */
const stemOf = (file: string): string => file.replace(/\.[cm]?[jt]sx?$/, '').replace(/\.(test|spec)$/, '');

const MAX_CONTEXT_FILE = 64 * 1024;

/** A request's key, `<task>/<request>`, as its two names. */
const requestKey = (key: string): [string, string] => {
  const [requester = '', name = ''] = key.split('/');

  return [requester, name];
};

/** How many of a task's notes a context hands on: the latest, which say where it stands — not every turn it waited. */
const CONTEXT_NOTES = 5;

const lastNotes = (view: TaskView): string[] => view.state.notes.slice(-CONTEXT_NOTES).map(note => note.text);

export const textOf = async (
  loaded: LoadedRun,
  ctx: RunContext,
  digest: string | null,
  file: string
): Promise<string> => {
  if (digest === null) {
    return '';
  }

  const bytes = await getBlob(loaded.paths, digest).catch(() => readOptional(under(ctx.root, file)));

  return bytes?.toString('utf-8') ?? '';
};

/**
 * A task's requests on shared files, each with what it changes: an integration task's, the ones it applies; any other
 * task's, the ones it made — from the version it started from to the one it asks for, not against the file now. What
 * `task context` and `task show` both say (three agents diffed blobs by hash to read a request).
 */
export const requestsShown = async (
  ctx: RunContext,
  loaded: LoadedRun,
  task: RunTask,
  view: TaskView
): Promise<TaskContext['requests']> => {
  const requests: TaskContext['requests'] = [];
  const asked: [string, string][] = task.integrates
    ? task.integrates.map(requestKey)
    : view.requests.map(request => [task.id, request.id]);
  for (const [requester, name] of asked) {
    const requesterView = requester === task.id ? view : await viewTask(loaded.paths, findTask(loaded, requester));
    const request = requesterView.requests.find(each => each.id === name);
    if (!request) {
      continue;
    }

    const before = await textOf(loaded, ctx, request.base, request.file);
    const wanted = await textOf(loaded, ctx, request.wanted, request.file);
    const diff = before === wanted ? undefined : unifiedDiff(request.file, before, wanted);
    requests.push({
      task: requester,
      file: request.file,
      summary: request.summary,
      usedIn: request.usedIn,
      ...(diff ? { diff } : {}),
      notes: lastNotes(requesterView)
    });
  }

  return requests;
};

/**
 * `plitzi task context`: what a task needs and nothing more, so its context stays small — the requests and their
 * diffs (an integration's), what related tasks did and noted, the plan's contracts, the project's and the run's notes, and its files.
 */
export const taskContext = async (ctx: RunContext, runId: string, taskId: string): Promise<TaskContext> => {
  const loaded = await loadRun(ctx, runId, { anyVersion: true });
  const task = findTask(loaded, taskId);
  const view = await viewTask(loaded.paths, task);
  const approved = await readApproved(loaded.paths);
  const requests = await requestsShown(ctx, loaded, task, view);

  const relatedIds = new Set([...task.dependsOn, ...requests.map(request => request.task)]);
  const related: TaskContext['related'] = [];
  for (const id of relatedIds) {
    const other = await viewTask(loaded.paths, findTask(loaded, id));
    related.push({
      task: id,
      title: other.task.title,
      status: other.state.status,
      changed: other.state.changed ?? [],
      notes: lastNotes(other),
      ...(other.state.findings && other.state.findings.length > 0 ? { findings: other.state.findings } : {}),
      ...(task.dependsOn.includes(id)
        ? {
            asked: {
              acceptance: other.task.acceptance.map(each => acceptanceText(each)),
              reviews: other.state.notes.filter(note => /^Review \d+: /.test(note.text)).map(note => note.text)
            }
          }
        : {})
    });
  }

  // Its files as it works on them: its copy's while it holds one, the run's otherwise.
  const copy = view.owner !== undefined && (await readStart(view.paths)) !== undefined;
  const files: TaskContext['files'] = [];
  for (const file of task.files) {
    const current = await currentVersion(ctx, approved, file);
    let bytes: Buffer | undefined;
    if (copy) {
      bytes = await readOptional(under(view.paths.work, file));
    } else if (current.digest !== null) {
      bytes = current.fromProject
        ? await readOptional(under(ctx.root, file))
        : await getBlob(loaded.paths, current.digest);
    }

    const from = copy ? 'copy' : 'run';
    if (bytes === undefined) {
      files.push({ file, from, toCreate: true });
    } else if (bytes.length <= MAX_CONTEXT_FILE && !bytes.includes(0)) {
      files.push({ file, from, text: bytes.toString('utf-8') });
    } else {
      files.push({ file, from, bytes: bytes.length });
    }
  }

  const projectNotes = (await readOptional(under(ctx.root, PROJECT_NOTES)))?.toString('utf-8');
  const restrictions = isResearch(task) ? [] : await restrictionsOn(ctx.root, task.files);
  const primer = (await readOptional(loaded.paths.primer))?.toString('utf-8');
  const proposals = await proposalsOf(loaded);

  return {
    task,
    state: view.state,
    ...(view.owner ? { holder: view.owner.agent } : {}),
    ...(view.review
      ? { review: { round: view.review.round, verdict: view.review.verdict, comments: view.review.comments } }
      : {}),
    requests,
    related,
    approved: [...task.files, ...(task.touches ?? [])].flatMap(file =>
      Object.hasOwn(approved.files, file)
        ? [{ file, task: approved.files[file].task, at: approved.files[file].at }]
        : []
    ),
    contracts: loaded.plan.contracts ?? [],
    proposals: {
      incoming: proposals.filter(each => each.to === taskId),
      outgoing: proposals.filter(each => each.from === taskId),
      agreements: agreementsOf(proposals, taskId)
    },
    ...(projectNotes !== undefined ? { projectNotes } : {}),
    ...(primer !== undefined ? { primer } : {}),
    reading: await readingFor(ctx.root, [...task.files, ...(task.touches ?? [])], { research: isResearch(task) }),
    runNotes: (await runNotesOf(loaded)).map(note => note.text),
    files,
    sourceRoot: copy ? view.paths.work : ctx.root,
    neighbours: loaded.tasks.flatMap(other =>
      other.id === task.id
        ? []
        : other.files
            .filter(file => !task.files.includes(file) && task.files.some(own => stemOf(own) === stemOf(file)))
            .map(file => ({ file, task: other.id, role: roleOf(other) }))
    ),
    restrictions
  };
};
