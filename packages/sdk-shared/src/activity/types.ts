import type { ChangeAuthor, ChangeDocument, ChangeOrigin } from '../history/types';

/**
 * What happened on a space, as an agent or a person following it reads it: the draft changed, a version went out, an
 * action failed. One vocabulary for the three surfaces that read it — the MCP's `plitzi_activity`, the CLI's
 * `plitzi space activity` and the platform's `GET /spaces/:spaceId/activity` — so none of them describes it again.
 *
 * Each kind is read off a record the platform already keeps — the change history, the space's log, the action runs —
 * so the activity is never a second copy that could disagree with them.
 */

/** The draft changed: one save, by whoever made it, through whichever channel. */
export type ChangeActivity = {
  kind: 'change';
  /** Milliseconds, UTC. */
  at: number;
  /** Its place in the draft's change history: what `plitzi://changes/main/{seq}` reads whole. */
  seq: number;
  document: ChangeDocument;
  author: ChangeAuthor;
  origin: ChangeOrigin;
  /** The MCP client's name, or the builder tab's instance id. */
  client?: string;
  /** One line per thing it did, as the builder's history says it. */
  summary: string;
  /** What it touched, by id — elements, selectors, tokens, files — at most {@link ACTIVITY_TOUCHED_MAX}. */
  touched: string[];
  /** How many more it touched than `touched` lists. */
  moreTouched?: number;
};

/** A version of the space went out: published to an environment, its flags published, or deployed. */
export type PublishActivity = {
  kind: 'publish';
  at: number;
  author: ChangeAuthor;
  /** `publish` — a version or its flags — or `deployment`, to a CDN. */
  what: 'publish' | 'deployment';
  environment?: string;
  /** The space's log line, as the builder's activity shows it. */
  message: string;
};

/** A server action did not complete, or a call to one was refused. A run that completed is not news. */
export type ActionActivity = {
  kind: 'action';
  at: number;
  actionId: string;
  trigger: string;
  /** `refused`, or how a run that did not complete ended. */
  status: string;
  environment?: string;
  /** The run, for `GET /spaces/:spaceId/actions/runs/:runId`. Absent on a refusal. */
  runId?: string;
  /** Why it failed, or the refusal's detail — redacted before it was recorded. */
  error?: string;
  /** Why it was refused. */
  reason?: string;
};

export type SpaceActivity = ChangeActivity | PublishActivity | ActionActivity;

export type SpaceActivityKind = SpaceActivity['kind'];

/** What to read: everything after a cursor, waiting for it when there is nothing yet. */
export type SpaceActivityQuery = {
  /**
   * The `cursor` of the last page read. Left out: the latest activity, and the cursor to follow it from — never a
   * wait, since there is nothing yet to wait after.
   */
  after?: string;
  /** How long to wait for something when nothing is there yet, in seconds, up to {@link ACTIVITY_WAIT_MAX_SECONDS}. */
  wait?: number;
  /** At most this many, up to {@link ACTIVITY_LIMIT_MAX}. */
  limit?: number;
  /** Include the reader's own changes: those made by the same person through the channel it reads from. */
  mine?: boolean;
};

/** Who reads, so their own writes can be told apart: the person, and the channel their writes are recorded under. */
export type ActivityReader = { userId?: number; origin: ChangeOrigin };

/** A page of activity, oldest first. */
export type SpaceActivityPage = {
  activity: SpaceActivity[];
  /** Pass as `after` to read what comes next. It moves past what was left out too. */
  cursor: string;
  /** More was there than one page holds: read again at once. */
  more: boolean;
  /** How long it waited before answering, in milliseconds: 0 when something was already there. */
  waitedMs: number;
  /** The reader's own changes it left out (`mine` includes them), so leaving them out is never silent. */
  skippedMine: number;
};

/** Long enough to be worth a call, short enough for every client and gateway in between: most cut a request at 60 s. */
export const ACTIVITY_WAIT_MAX_SECONDS = 50;

export const ACTIVITY_WAIT_DEFAULT_SECONDS = 45;

export const ACTIVITY_LIMIT_DEFAULT = 20;

export const ACTIVITY_LIMIT_MAX = 100;

export const ACTIVITY_TOUCHED_MAX = 20;
