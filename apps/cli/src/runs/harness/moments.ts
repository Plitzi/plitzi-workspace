import fs from 'node:fs/promises';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { claudeSessionFile } from './claude';
import { codexSessionFile } from './codex';
import { withOpenCodeSession } from './opencode';

import type { HarnessName } from './types';

/**
 * What an agent's harness is doing, as its own session keeps it: what the model said, each tool it called and on what,
 * and the first line of what each answered — read off the session the harness writes as it goes, so a person follows an
 * agent run headless, whose own output is only its last answer.
 */

export interface SessionMoment {
  at: string;
  kind: 'said' | 'tool' | 'result';
  text: string;
  /** The whole of it, when `text` says less — a message's lines, a command, an answer: what a person opens it to read. */
  whole?: string;
  /** A tool's answer that was an error. */
  failed?: true;
}

/** Where an agent's session is, as its launch kept it. */
export interface SessionAt {
  harness: HarnessName;
  /** Claude Code's session id: its file's name. */
  session?: string;
  /** When its process started: Codex and OpenCode name no session, theirs is the one that started with it. */
  startedAt: string;
}

/** How much of a session's end is read: its last moments, whatever its length — a session of hours is megabytes. */
const TAIL_BYTES = 256 * 1024;

const MOMENT_CHARS = 240;

/** The most of a moment's whole kept: a tool's answer runs to megabytes, and a person reads its start. */
const WHOLE_CHARS = 4000;

/** A moment's whole, when its one line says less — cut past `WHOLE_CHARS`, saying how much is left out. */
const wholeOf = (text: string, line: string): { whole: string } | Record<string, never> => {
  const trimmed = text.trim();
  if (trimmed === line) {
    return {};
  }

  return {
    whole:
      trimmed.length > WHOLE_CHARS
        ? `${trimmed.slice(0, WHOLE_CHARS)}\n… ${String(trimmed.length - WHOLE_CHARS)} characters more`
        : trimmed
  };
};

/** A moment of `kind` said by `text`: its line, and its whole when the line says less. */
const momentOf = (
  at: string,
  kind: SessionMoment['kind'],
  line: string,
  text: string,
  failed?: boolean
): SessionMoment => ({ at, kind, text: line, ...wholeOf(text, line), ...(failed === true ? { failed: true } : {}) });

/** A text on one line, as a moment says it: its first lines joined, cut to what a row holds. */
const oneLine = (text: string): string => {
  const said = text.replace(/\s+/g, ' ').trim();

  return said.length > MOMENT_CHARS ? `${said.slice(0, MOMENT_CHARS - 1)}…` : said;
};

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The project's paths in a text, as short as they read: a task's copy's from that copy, an agent's scratch as
 * `scratch/`, the rest from the project — a row of a narrow sidebar was its copy's 90-character prefix alone.
 */
const shortPaths = (text: string, root: string): string => {
  const at = escaped(root.replace(/\/+$/, ''));

  return text
    .replace(new RegExp(`${at}/tmp/plitzi-runs/[^/\\s]+/tasks/[^/\\s]+/cache/work/?`, 'g'), '')
    .replace(new RegExp(`${at}/tmp/plitzi-runs/[^/\\s]+/scratch/[^/\\s]+/?`, 'g'), 'scratch/')
    .replace(new RegExp(`${at}/?`, 'g'), '');
};

/** The first line of an answer that says something: what a glance needs of a tool's output. */
const firstLine = (text: string): string => oneLine(text.split('\n').find(line => line.trim() !== '') ?? '');

/** What a tool was asked, as a person reads it: the command, the file (from the project), the pattern, the address. */
const toolText = (tool: string, input: unknown, root: string): string => {
  if (!isRecord(input)) {
    return tool;
  }

  const said = [input.command, input.cmd, input.file_path, input.filePath, input.path, input.pattern, input.url].find(
    (value): value is string => typeof value === 'string' && value !== ''
  );
  if (said === undefined) {
    return tool;
  }

  return oneLine(`${tool} ${firstLine(shortPaths(said, root)) || '.'}`);
};

/** What a tool was asked, whole: its command or its input as it was given. */
const toolWhole = (tool: string, input: unknown, root: string): string => {
  const said = isRecord(input)
    ? [input.command, input.cmd, input.file_path, input.filePath, input.path, input.pattern, input.url].find(
        (value): value is string => typeof value === 'string' && value !== ''
      )
    : undefined;

  return `${tool} ${shortPaths(said ?? JSON.stringify(input ?? ''), root)}`;
};

/** A tool's answer as text, however the harness keeps it: a string, or parts of text. */
const answerText = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content.flatMap(part => (isRecord(part) && typeof part.text === 'string' ? [part.text] : [])).join('\n');
  }

  return '';
};

/** The whole lines of a file's last `TAIL_BYTES`: the first, cut where the read starts, left out. */
const tailLines = async (file: string): Promise<string[]> => {
  const handle = await fs.open(file, 'r');
  try {
    const { size } = await handle.stat();
    const start = Math.max(0, size - TAIL_BYTES);
    const buffer = Buffer.alloc(size - start);
    await handle.read(buffer, 0, buffer.length, start);
    const lines = buffer.toString('utf-8').split('\n');

    return start > 0 ? lines.slice(1) : lines;
  } finally {
    await handle.close();
  }
};

const entriesOf = (lines: readonly string[]): Record<string, unknown>[] =>
  lines.flatMap(line => {
    try {
      const entry: unknown = JSON.parse(line);

      return isRecord(entry) ? [entry] : [];
    } catch {
      return [];
    }
  });

/** Claude Code's: the model's turns and the tool answers given back to it — its request copies left out. */
export const claudeMoments = (lines: readonly string[], root: string): SessionMoment[] =>
  entriesOf(lines).flatMap(entry => {
    const message = isRecord(entry.message) ? entry.message : undefined;
    const at = typeof entry.timestamp === 'string' ? entry.timestamp : '';
    if ((entry.type !== 'assistant' && entry.type !== 'user') || message === undefined) {
      return [];
    }

    const content: unknown[] = Array.isArray(message.content) ? message.content : [];

    return content.flatMap((block): SessionMoment[] => {
      if (!isRecord(block)) {
        return [];
      }

      if (block.type === 'text' && entry.type === 'assistant' && typeof block.text === 'string') {
        const said = shortPaths(block.text, root);

        return block.text.trim() === '' ? [] : [momentOf(at, 'said', oneLine(said), said)];
      }

      if (block.type === 'tool_use' && typeof block.name === 'string') {
        return [
          momentOf(at, 'tool', toolText(block.name, block.input, root), toolWhole(block.name, block.input, root))
        ];
      }

      if (block.type === 'tool_result') {
        const answer = shortPaths(answerText(block.content), root);

        return [momentOf(at, 'result', firstLine(answer), answer, block.is_error === true)];
      }

      return [];
    });
  });

/** Codex's: its answers' text, its function calls and what each gave back. */
export const codexMoments = (lines: readonly string[], root: string): SessionMoment[] =>
  entriesOf(lines).flatMap((entry): SessionMoment[] => {
    const payload = isRecord(entry.payload) ? entry.payload : {};
    const at = typeof entry.timestamp === 'string' ? entry.timestamp : '';
    if (payload.type === 'message' && payload.role === 'assistant') {
      const text = answerText(payload.content);

      return text.trim() === '' ? [] : [momentOf(at, 'said', oneLine(text), text)];
    }

    if ((payload.type === 'function_call' || payload.type === 'custom_tool_call') && typeof payload.name === 'string') {
      const raw = payload.arguments ?? payload.input;
      let input: unknown = raw;
      if (typeof raw === 'string') {
        try {
          input = JSON.parse(raw);
        } catch {
          input = { command: raw };
        }
      }

      return [momentOf(at, 'tool', toolText(payload.name, input, root), toolWhole(payload.name, input, root))];
    }

    if (payload.type === 'function_call_output' || payload.type === 'custom_tool_call_output') {
      const output = isRecord(payload.output) ? payload.output.content : payload.output;

      const answer = shortPaths(answerText(output), root);

      return [momentOf(at, 'result', firstLine(answer), answer)];
    }

    return [];
  });

/** OpenCode's parts, oldest first: text the model wrote, and each tool with what it answered. */
export const openCodeMoments = (parts: readonly { at: string; data: unknown }[], root: string): SessionMoment[] =>
  parts.flatMap(({ at, data }): SessionMoment[] => {
    if (!isRecord(data)) {
      return [];
    }

    if (data.type === 'text' && typeof data.text === 'string' && data.text.trim() !== '') {
      return [momentOf(at, 'said', oneLine(data.text), data.text)];
    }

    if (data.type === 'tool' && typeof data.tool === 'string') {
      const state = isRecord(data.state) ? data.state : {};
      const answer =
        typeof state.output === 'string' ? state.output : typeof state.error === 'string' ? state.error : '';

      return [
        momentOf(at, 'tool', toolText(data.tool, state.input, root), toolWhole(data.tool, state.input, root)),
        ...(answer === ''
          ? []
          : [
              momentOf(
                at,
                'result',
                firstLine(shortPaths(answer, root)),
                shortPaths(answer, root),
                state.status === 'error'
              )
            ])
      ];
    }

    return [];
  });

const json = (value: unknown): unknown => {
  try {
    return typeof value === 'string' ? (JSON.parse(value) as unknown) : undefined;
  } catch {
    return undefined;
  }
};

/**
 * An agent's last `limit` moments, from the session its harness keeps on this machine — or why there are none to read:
 * no session of it found yet (one just started), or a harness that keeps none here.
 */
export const recentMoments = async (
  at: SessionAt,
  root: string,
  limit: number
): Promise<SessionMoment[] | { problem: string }> => {
  const startedAt = Date.parse(at.startedAt);
  if (at.harness === 'claude') {
    const file = at.session === undefined ? undefined : await claudeSessionFile(at.session);

    return file === undefined
      ? { problem: 'no Claude Code session of it on this machine yet' }
      : claudeMoments(await tailLines(file), root).slice(-limit);
  }

  if (at.harness === 'codex') {
    const file = await codexSessionFile(startedAt, root);

    return file === undefined
      ? { problem: 'no Codex session of it on this machine yet' }
      : codexMoments(await tailLines(file), root).slice(-limit);
  }

  const parts = await withOpenCodeSession(startedAt, root, (database, session) =>
    database
      .prepare('SELECT time_created, data FROM part WHERE session_id = ? ORDER BY time_created DESC LIMIT ?')
      .all(session.id, limit * 2)
      .flatMap(row =>
        isRecord(row) ? [{ at: new Date(Number(row.time_created)).toISOString(), data: json(row.data) }] : []
      )
      .reverse()
  );

  return parts === undefined
    ? { problem: 'no OpenCode session of it on this machine yet' }
    : openCodeMoments(parts, root).slice(-limit);
};
