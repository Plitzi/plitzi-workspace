import os from 'node:os';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { charsOf, numberOf, whatOf } from './types';

import type { SessionRead } from './types';

/**
 * An OpenCode session, as it keeps it: rows of its SQLite store (`~/.local/share/opencode/opencode.db`,
 * `XDG_DATA_HOME` moves it) — the session with its folder and version, each message with its tokens and model, each part
 * a tool's call with what it was given and what it answered. OpenCode says no session id to the commands it runs: the
 * session is found by its harness process — the one that started within a minute or two of it, in the project's folder.
 */

/** How far a session's start may be from its process's. */
const STARTED_WITHIN_MS = 120_000;

const storeFile = (): string =>
  path.join(process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share'), 'opencode', 'opencode.db');

const json = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'string') {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const iso = (ms: unknown): string => new Date(numberOf(ms)).toISOString();

/**
 * The session an OpenCode process wrote — started with it, in the project's folder or below — with its store open:
 * `read` is given both, and the store is closed after. None where there is no store, or this Node has no SQLite.
 */
export const withOpenCodeSession = async <T>(
  startedAt: number,
  root: string,
  read: (database: import('node:sqlite').DatabaseSync, session: { id: string; version?: string }) => T
): Promise<T | undefined> => {
  let database: import('node:sqlite').DatabaseSync;
  try {
    // Loaded when a session of its is read, never at the CLI's start.
    const { DatabaseSync } = await import('node:sqlite');
    database = new DatabaseSync(storeFile(), { readOnly: true });
  } catch {
    return undefined;
  }

  try {
    const session = database
      .prepare(
        'SELECT id, version FROM session WHERE (directory = ? OR directory LIKE ?) AND abs(time_created - ?) <= ? ORDER BY abs(time_created - ?) LIMIT 1'
      )
      .get(root, `${root}${path.sep}%`, startedAt, STARTED_WITHIN_MS, startedAt);
    if (!isRecord(session) || typeof session.id !== 'string') {
      return undefined;
    }

    return read(database, {
      id: session.id,
      ...(typeof session.version === 'string' ? { version: session.version } : {})
    });
  } finally {
    database.close();
  }
};

export const readOpenCode = (
  startedAt: number,
  root: string,
  from: string,
  to: string
): Promise<SessionRead | undefined> =>
  withOpenCodeSession(startedAt, root, (database, session) => {
    const read: SessionRead = {
      harness: 'opencode',
      ...(session.version === undefined ? {} : { version: session.version }),
      turns: [],
      calls: new Map(),
      results: []
    };
    const window = [Date.parse(from), Date.parse(to)] as const;
    for (const row of database
      .prepare('SELECT id, time_created, data FROM message WHERE session_id = ? AND time_created BETWEEN ? AND ?')
      .all(session.id, ...window)) {
      const message = json(row.data);
      if (message.role !== 'assistant' || !isRecord(message.tokens)) {
        continue;
      }

      const cache = isRecord(message.tokens.cache) ? message.tokens.cache : {};
      read.turns.push({
        id: String(row.id),
        at: iso(row.time_created),
        input: numberOf(message.tokens.input),
        cacheRead: numberOf(cache.read),
        cacheWrite: numberOf(cache.write),
        cacheWriteLong: 0,
        output: numberOf(message.tokens.output) + numberOf(message.tokens.reasoning)
      });
      read.model = typeof message.modelID === 'string' ? message.modelID : read.model;
    }

    for (const row of database
      .prepare('SELECT id, time_created, data FROM part WHERE session_id = ? AND time_created BETWEEN ? AND ?')
      .all(session.id, ...window)) {
      const part = json(row.data);
      const state = isRecord(part.state) ? part.state : {};
      if (part.type !== 'tool' || typeof part.tool !== 'string') {
        continue;
      }

      const key = typeof part.callID === 'string' ? part.callID : String(row.id);
      const what = whatOf(part.tool, state.input);
      read.calls.set(key, { tool: part.tool, what, input: JSON.stringify(state.input ?? '') });
      // OpenCode keeps a call and its answer in one part: what was asked is always beside it.
      read.results.push({ at: iso(row.time_created), chars: charsOf(state.output), tool: part.tool, what });
    }

    return read.turns.length === 0 ? undefined : read;
  });
