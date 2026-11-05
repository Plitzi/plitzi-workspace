import type { LogLevel, ServerLogEvent } from '../types';

/**
 * The last lines a process said, every level included — what its console leaves out too: a probe answered, a run that
 * worked. Kept in memory and read behind the process's stats secret (`GET /_stats/logs`), so an operator reads ONE
 * instance's log from the back-office without a log shipper, and without the console saying everything to everybody.
 *
 * A line is kept as it renders — the dispatcher already stripped query values, headers, cookies and tokens; a request's
 * client IP is on it, so what reads it is staff's alone.
 */

/** One line of a process's log, numbered so a reader asks only for what came after the last one it has. */
export type LogLine = {
  seq: number;
  /** ISO 8601, UTC. */
  at: string;
  level: LogLevel;
  /** What said it: `request`, `run`, `reject`, `tool`, `resource`, `message`, or the deployment's own (`app`). */
  kind: string;
  text: string;
};

export type LogQuery = {
  /** Only lines after this one. */
  since?: number;
  /** Only lines at this level or more severe: `warn` is warnings and errors. */
  level?: LogLevel;
  /** At most this many, the newest. Default and ceiling {@link LOG_TAIL_SIZE}. */
  limit?: number;
  /** Only lines whose text holds this, case aside. */
  q?: string;
};

/** How many lines a process keeps: a busy minute of a page server, an hour of a quiet worker. */
export const LOG_TAIL_SIZE = 1000;

const RANK: Record<LogLevel, number> = { error: 1, warn: 2, info: 3, debug: 4 };

const lines: LogLine[] = [];
let seq = 0;

/** Keeps a line said by the deployment's own logger (`kind: 'app'`) beside the kernel's. */
export const keepLogLine = (level: LogLevel, text: string, kind = 'app'): void => {
  seq += 1;
  lines.push({ seq, at: new Date().toISOString(), level, kind, text });
  if (lines.length > LOG_TAIL_SIZE) {
    lines.splice(0, lines.length - LOG_TAIL_SIZE);
  }
};

/** Keeps an event, rendered, at its own level. */
export const keepLogEvent = (event: ServerLogEvent, level: LogLevel, text: string): void => {
  keepLogLine(level, text, event.kind);
};

/** What a reader asked for, oldest first, and the newest line's number — what it asks `since` next. */
export const readLogTail = ({ since = 0, level = 'debug', limit = LOG_TAIL_SIZE, q }: LogQuery = {}): {
  lines: LogLine[];
  last: number;
  kept: number;
} => {
  const needle = q?.trim().toLowerCase();
  const picked = lines.filter(
    line => line.seq > since && RANK[line.level] <= RANK[level] && (!needle || line.text.toLowerCase().includes(needle))
  );

  return { lines: picked.slice(-Math.min(Math.max(1, limit), LOG_TAIL_SIZE)), last: seq, kept: lines.length };
};

const LEVELS: readonly LogLevel[] = ['error', 'warn', 'info', 'debug'];

/** A log query from a request's query string, every value checked: what it cannot read is left at its default. */
export const logQueryOf = (query: Record<string, string | undefined>): LogQuery => {
  const since = Number(query.since);
  const limit = Number(query.limit);
  const level = LEVELS.find(each => each === query.level);

  return {
    ...(Number.isInteger(since) && since > 0 ? { since } : {}),
    ...(Number.isInteger(limit) && limit > 0 ? { limit } : {}),
    ...(level ? { level } : {}),
    ...(query.q ? { q: query.q.slice(0, 200) } : {})
  };
};
