import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

/** The harnesses whose sessions a run reads what they spent from. */
export type HarnessName = 'claude' | 'codex' | 'opencode';

/** What an agent's harness spent in a window of time — a task's round, the lead's run. */
export interface HarnessUsage {
  harness: HarnessName;
  /** The model it ran on, how hard it thought, and the harness's version: what a run compares runs by. */
  model?: string;
  effort?: string;
  version?: string;
  /** The model's answers in the window. */
  turns: number;
  /** Tokens sent fresh, read from the cache, written to it, written out — summed over the turns. */
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
  /** All it read: each turn's whole context, summed — what the window cost. */
  processed: number;
  /** Its context at the window's last turn. */
  contextAtEnd: number;
  /** The results that weighed most: how many, their size, and the tokens they were read again for in later turns. */
  heaviest: { tool: string; what: string; results: number; chars: number; reread: number }[];
  /**
   * Plitzi's own docs and types it read — a skill's file, a package's declarations — and how often: a doc read before a
   * failure is the doc to fix (lx-product's dev-1 read the packages' types 25 times for what `explain` did not say).
   */
  plitziRead: { file: string; times: number }[];
}

/** A session as one harness keeps it, read the same way for each: its answers, its tool calls and their results. */
export interface SessionRead {
  harness: HarnessName;
  model?: string;
  effort?: string;
  version?: string;
  turns: { id: string; at: string; input: number; cacheRead: number; cacheWrite: number; output: number }[];
  /** Each tool call by its id: the tool, what it was asked in a few words, and what it was given whole. */
  calls: Map<string, { tool: string; what: string; input: string }>;
  results: { at: string; key: string; chars: number }[];
}

export const numberOf = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** A result's size, whatever shape the harness keeps it in: a string, or parts with text. */
export const charsOf = (content: unknown): number => {
  if (typeof content === 'string') {
    return content.length;
  }

  return Array.isArray(content)
    ? content.reduce<number>(
        (sum, part) => sum + (isRecord(part) && typeof part.text === 'string' ? part.text.length : 0),
        0
      )
    : 0;
};

/** The shell command a tool was asked to run, as each harness writes it: a string, or its words. */
const commandOf = (input: Record<string, unknown>): string | undefined => {
  const command = input.command ?? input.cmd;

  return typeof command === 'string'
    ? command
    : Array.isArray(command)
      ? command.filter((word): word is string => typeof word === 'string').join(' ')
      : undefined;
};

/** What a tool was asked, in words that say its kind and nothing of the project: `plitzi page measure`, `Read .ts`. */
export const whatOf = (tool: string, input: unknown): string => {
  if (!isRecord(input)) {
    return tool;
  }

  const command = commandOf(input);
  if (command !== undefined) {
    // The command itself, past a `cd …&&` and variables set before it; a CLI by its path is named by its file.
    const words = command
      .replace(/^\s*(bash|zsh|sh)\s+-l?c\s+/, '')
      .replace(/^\s*cd\s+\S+\s*&&\s*/, '')
      .split(/\s+/)
      .filter(word => word !== '' && !/^[A-Z_][A-Z0-9_]*=/.test(word))
      .map(word => path.basename(word.replace(/^['"]|['"]$/g, '')));
    const first = words.at(0) ?? '';

    return [first === 'npx' ? words.slice(0, 2) : [first], first === 'plitzi' ? words.slice(1, 3) : []]
      .flat()
      .filter(word => /^[\w.-]+$/.test(word))
      .join(' ');
  }

  const file = input.file_path ?? input.filePath ?? input.path;

  return typeof file === 'string' ? `${tool} ${path.extname(file) || 'file'}` : tool;
};

/** A file of Plitzi's own named in what a tool was given: a skill's, or a `@plitzi` package's. */
const PLITZI_FILE = /(?:skills\/plitzi-[\w-]+\/[\w./-]+\.\w+|@plitzi\/[\w-]+\/[\w./-]+\.\w+)/g;

/** How many of the heaviest kinds of result, and of Plitzi's files read, are kept. */
const KEPT = 8;

/** What the sessions spent from `from` to `to`, put together — or nothing when none had a turn in the window. */
export const usageOf = (reads: readonly SessionRead[]): HarnessUsage | undefined => {
  const answered = reads.flatMap(read => read.turns).sort((a, b) => a.at.localeCompare(b.at));
  if (answered.length === 0) {
    return undefined;
  }

  // The session that did most of the work says the harness and its model.
  const main = [...reads].sort((a, b) => b.turns.length - a.turns.length)[0];
  const calls = new Map(reads.flatMap(read => [...read.calls]));
  const last = answered[answered.length - 1];
  const heaviest = new Map<string, HarnessUsage['heaviest'][number]>();
  for (const result of reads.flatMap(read => read.results)) {
    const asked = calls.get(result.key) ?? { tool: 'unknown', what: 'unknown' };
    const after = answered.filter(turn => turn.at > result.at).length;
    const kind = `${asked.tool} ${asked.what}`;
    const kept = heaviest.get(kind) ?? { tool: asked.tool, what: asked.what, results: 0, chars: 0, reread: 0 };
    kept.results += 1;
    kept.chars += result.chars;
    // About four characters a token: what the result was read again for in every turn after it.
    kept.reread += Math.round(result.chars / 4) * after;
    heaviest.set(kind, kept);
  }

  const read = new Map<string, number>();
  for (const call of calls.values()) {
    for (const file of new Set(call.input.match(PLITZI_FILE) ?? [])) {
      read.set(file, (read.get(file) ?? 0) + 1);
    }
  }

  const sum = (pick: (turn: (typeof answered)[number]) => number): number =>
    answered.reduce((total, turn) => total + pick(turn), 0);

  return {
    harness: main.harness,
    ...(main.model ? { model: main.model } : {}),
    ...(main.effort ? { effort: main.effort } : {}),
    ...(main.version ? { version: main.version } : {}),
    turns: answered.length,
    input: sum(turn => turn.input),
    cacheRead: sum(turn => turn.cacheRead),
    cacheWrite: sum(turn => turn.cacheWrite),
    output: sum(turn => turn.output),
    processed: sum(turn => turn.input + turn.cacheRead + turn.cacheWrite + turn.output),
    contextAtEnd: last.input + last.cacheRead + last.cacheWrite,
    heaviest: [...heaviest.values()].sort((a, b) => b.reread - a.reread).slice(0, KEPT),
    plitziRead: [...read]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, KEPT * 2)
      .map(([file, times]) => ({ file, times }))
  };
};
