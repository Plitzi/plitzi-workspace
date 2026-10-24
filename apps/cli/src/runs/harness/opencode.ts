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

export const readOpenCode = async (
  startedAt: number,
  root: string,
  from: string,
  to: string
): Promise<SessionRead | undefined> => {
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

    const read: SessionRead = {
      harness: 'opencode',
      ...(typeof session.version === 'string' ? { version: session.version } : {}),
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
      read.calls.set(key, {
        tool: part.tool,
        what: whatOf(part.tool, state.input),
        input: JSON.stringify(state.input ?? '')
      });
      read.results.push({ at: iso(row.time_created), key, chars: charsOf(state.output) });
    }

    return read.turns.length === 0 ? undefined : read;
  } finally {
    database.close();
  }
};
