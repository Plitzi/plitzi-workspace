import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { charsOf, numberOf, whatOf } from './types';

import type { SessionRead } from './types';

/**
 * A Claude Code session, as it keeps it: `~/.claude/projects/<folder>/<session>.jsonl` (`CLAUDE_CONFIG_DIR` moves it),
 * an entry a line — the model's answers with their usage, the tool calls in them, their results in the next.
 */

/** A Claude Code session's id, as it names its file. */
export const CLAUDE_SESSION = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const claudeHome = (): string => process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude');

/** Where a session is kept: under the folder it started in, which is looked for, never assumed. */
const sessionFile = async (session: string): Promise<string | undefined> => {
  const projects = path.join(claudeHome(), 'projects');
  for (const folder of await fs.readdir(projects).catch((): string[] => [])) {
    const file = path.join(projects, folder, `${session}.jsonl`);
    if (
      await fs
        .access(file)
        .then(() => true)
        .catch(() => false)
    ) {
      return file;
    }
  }

  return undefined;
};

const text = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined);

export const readClaude = async (session: string, from: string, to: string): Promise<SessionRead | undefined> => {
  const file = CLAUDE_SESSION.test(session) ? await sessionFile(session) : undefined;
  if (file === undefined) {
    return undefined;
  }

  const read: SessionRead = { harness: 'claude', turns: [], calls: new Map(), results: [] };
  const turns = new Map<string, SessionRead['turns'][number]>();
  for (const line of (await fs.readFile(file, 'utf-8').catch(() => '')).split('\n')) {
    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (!isRecord(entry) || typeof entry.timestamp !== 'string' || entry.timestamp < from || entry.timestamp > to) {
      continue;
    }

    const message = isRecord(entry.message) ? entry.message : undefined;
    const content = Array.isArray(message?.content) ? message.content : [];
    if (entry.type === 'assistant' && message && typeof message.id === 'string') {
      // One answer is kept in as many entries as it has parts, each with the answer's whole usage: counted once.
      const usage = isRecord(message.usage) ? message.usage : {};
      turns.set(message.id, {
        id: message.id,
        at: entry.timestamp,
        input: numberOf(usage.input_tokens),
        cacheRead: numberOf(usage.cache_read_input_tokens),
        cacheWrite: numberOf(usage.cache_creation_input_tokens),
        output: numberOf(usage.output_tokens)
      });
      read.model = text(entry.requestedModel) ?? text(message.model) ?? read.model;
      read.effort = text(entry.effort) ?? read.effort;
      read.version = text(entry.version) ?? read.version;
      for (const part of content) {
        if (
          isRecord(part) &&
          part.type === 'tool_use' &&
          typeof part.id === 'string' &&
          typeof part.name === 'string'
        ) {
          read.calls.set(part.id, {
            tool: part.name,
            what: whatOf(part.name, part.input),
            input: JSON.stringify(part.input ?? '')
          });
        }
      }
    } else if (entry.type === 'user') {
      for (const part of content) {
        if (isRecord(part) && part.type === 'tool_result' && typeof part.tool_use_id === 'string') {
          read.results.push({ at: entry.timestamp, key: part.tool_use_id, chars: charsOf(part.content) });
        }
      }
    }
  }

  read.turns = [...turns.values()];

  return read.turns.length === 0 ? undefined : read;
};
