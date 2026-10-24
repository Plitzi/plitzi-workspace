import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { charsOf, numberOf, whatOf } from './types';

import type { SessionRead } from './types';

/**
 * A Codex session, as it keeps it: `~/.codex/sessions/<year>/<month>/<day>/rollout-*.jsonl` (`CODEX_HOME` moves it),
 * an entry a line — its start (`session_meta`), each turn's settings, each answer's token usage, the tool calls and
 * their output. Codex says no session id to the commands it runs: the session is found by its harness process — the
 * one that started within a minute or two of it, in the project's folder.
 */

/** How far a session's start may be from its process's: the process starts, then writes its session. */
const STARTED_WITHIN_MS = 120_000;

const codexHome = (): string => process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex');

/** The day folders a session started at `at` may be in: its day, and the ones beside it for a zone or midnight. */
const dayFolders = (at: number): string[] =>
  [-1, 0, 1].map(offset => {
    const day = new Date(at + offset * 86_400_000);

    return path.join(
      codexHome(),
      'sessions',
      String(day.getFullYear()),
      String(day.getMonth() + 1).padStart(2, '0'),
      String(day.getDate()).padStart(2, '0')
    );
  });

const entriesOf = async (file: string): Promise<Record<string, unknown>[]> =>
  (await fs.readFile(file, 'utf-8').catch(() => '')).split('\n').flatMap(line => {
    try {
      const entry: unknown = JSON.parse(line);

      return isRecord(entry) ? [entry] : [];
    } catch {
      return [];
    }
  });

/** The session a Codex process wrote: started with it, in the project's folder or below. */
const sessionOf = async (startedAt: number, root: string): Promise<Record<string, unknown>[] | undefined> => {
  for (const folder of dayFolders(startedAt)) {
    for (const name of (await fs.readdir(folder).catch((): string[] => [])).filter(each => each.endsWith('.jsonl'))) {
      const entries = await entriesOf(path.join(folder, name));
      const meta = entries.find(entry => entry.type === 'session_meta')?.payload;
      if (
        isRecord(meta) &&
        typeof meta.timestamp === 'string' &&
        typeof meta.cwd === 'string' &&
        (meta.cwd === root || meta.cwd.startsWith(`${root}${path.sep}`)) &&
        Math.abs(Date.parse(meta.timestamp) - startedAt) <= STARTED_WITHIN_MS
      ) {
        return entries;
      }
    }
  }

  return undefined;
};

const argumentsOf = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return { command: value };
  }
};

export const readCodex = async (
  startedAt: number,
  root: string,
  from: string,
  to: string
): Promise<SessionRead | undefined> => {
  const entries = await sessionOf(startedAt, root);
  if (!entries) {
    return undefined;
  }

  const read: SessionRead = { harness: 'codex', turns: [], calls: new Map(), results: [] };
  const meta = entries.find(entry => entry.type === 'session_meta')?.payload;
  if (isRecord(meta) && typeof meta.cli_version === 'string') {
    read.version = meta.cli_version;
  }

  // Each answer's usage, kept once (`token_usage_record`) — an older Codex says it only in its running count.
  const records = entries.filter(entry => entry.type === 'token_usage_record');
  const usages = new Set(
    records.length > 0
      ? records
      : entries.filter(entry => isRecord(entry.payload) && entry.payload.type === 'token_count')
  );
  for (const entry of entries) {
    const at = typeof entry.timestamp === 'string' ? entry.timestamp : '';
    const payload = isRecord(entry.payload) ? entry.payload : {};
    if (at < from || at > to) {
      continue;
    }

    if (entry.type === 'turn_context') {
      read.model = typeof payload.model === 'string' ? payload.model : read.model;
      read.effort = typeof payload.effort === 'string' ? payload.effort : read.effort;
    } else if (usages.has(entry)) {
      const usage = isRecord(payload.usage)
        ? payload.usage
        : isRecord(payload.info) && isRecord(payload.info.last_token_usage)
          ? payload.info.last_token_usage
          : {};
      // Codex counts the cached part inside its input: what was sent fresh is the rest.
      const cached = numberOf(usage.cached_input_tokens);
      const written = numberOf(usage.cache_write_input_tokens);
      read.turns.push({
        id: typeof payload.response_id === 'string' ? payload.response_id : `${at}:${String(read.turns.length)}`,
        at,
        input: Math.max(0, numberOf(usage.input_tokens) - cached - written),
        cacheRead: cached,
        cacheWrite: written,
        output: numberOf(usage.output_tokens)
      });
    } else if (
      (payload.type === 'function_call' || payload.type === 'custom_tool_call') &&
      typeof payload.call_id === 'string' &&
      typeof payload.name === 'string'
    ) {
      const input = argumentsOf(payload.arguments ?? payload.input);
      read.calls.set(payload.call_id, {
        tool: payload.name,
        what: whatOf(payload.name, input),
        input: JSON.stringify(input ?? '')
      });
    } else if (
      (payload.type === 'function_call_output' || payload.type === 'custom_tool_call_output') &&
      typeof payload.call_id === 'string'
    ) {
      read.results.push({ at, key: payload.call_id, chars: charsOf(payload.output) });
    }
  }

  return read.turns.length === 0 ? undefined : read;
};
