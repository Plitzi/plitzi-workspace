import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { priceOf, turnCost } from './prices';

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
  /** What the window cost at the API's prices (`prices.ts`); none when a session's model has no price. */
  cost?: number;
  /** The tokens of each minute it answered in (`2026-10-25T17:02`): when the spend happened, for the monitor's chart. */
  minutes: { at: string; tokens: number }[];
  /** The results that weighed most: how many, their size, and the tokens they were read again for in later turns. */
  heaviest: { tool: string; what: string; results: number; chars: number; reread: number }[];
  /**
   * Plitzi's own docs and types it read — a skill's file, a package's declarations — and how often: a doc read before a
   * failure is the doc to fix (a run's dev-1 read the packages' types 25 times for what `explain` did not say).
   */
  plitziRead: { file: string; times: number }[];
}

/** A session as one harness keeps it, read the same way for each: its answers, its tool calls and their results. */
export interface SessionRead {
  harness: HarnessName;
  model?: string;
  effort?: string;
  version?: string;
  /** Each answer's tokens; `cacheWriteLong` the part of `cacheWrite` kept an hour, which costs more (0 when unsaid). */
  turns: {
    id: string;
    at: string;
    input: number;
    cacheRead: number;
    cacheWrite: number;
    cacheWriteLong: number;
    output: number;
  }[];
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

/**
 * What a tool was asked, in words that say its kind and nothing of the project — the tool itself left to `kindOf`:
 * `plitzi page measure`, `.ts`. A run read "Read Read .ts", and "Bash " for 371 results: a command after a comment,
 * a `cd …;`, a subshell, or a loop had no word that named it.
 */
export const whatOf = (_tool: string, input: unknown): string => {
  if (!isRecord(input)) {
    return '';
  }

  const command = commandOf(input);
  if (command !== undefined) {
    // The first line that runs something, past comments, a `cd …` and variables set before it; a CLI by its path is
    // named by its file.
    const line =
      command
        .replace(/^\s*(bash|zsh|sh)\s+-l?c\s+/, '')
        .split('\n')
        .map(each => each.trim())
        .find(each => each !== '' && !each.startsWith('#')) ?? '';
    const words = line
      .replace(/^[({]\s*/, '')
      .replace(/^cd\s+\S+\s*(&&|;)\s*/, '')
      .replace(/^(for|while|if)\b.*?;\s*(do|then)\s+/, '')
      .split(/\s+/)
      .filter(word => word !== '' && !/^[A-Z_][A-Z0-9_]*=/.test(word))
      .map(word => path.basename(word.replace(/^['"]|['"]$/g, '')));
    const first = words.at(0) ?? '';
    const named = [first === 'npx' ? words.slice(0, 2) : [first], first === 'plitzi' ? words.slice(1, 3) : []]
      .flat()
      .filter(word => /^[\w.-]+$/.test(word))
      .join(' ');

    return named === '' ? 'a shell script' : named;
  }

  const file = input.file_path ?? input.filePath ?? input.path;

  return typeof file === 'string' ? path.extname(file) || 'file' : '';
};

/** A tool's kind of result, as reports name it: `Bash plitzi page measure`, `Read .ts`, `Grep`. */
export const kindOf = (tool: string, what: string): string => (what === '' ? tool : `${tool} ${what}`);

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
    const kind = kindOf(asked.tool, asked.what);
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
  const prices = reads.map(each => ({ read: each, price: priceOf(each.model) }));
  const priced = prices.every(each => each.price !== undefined || each.read.turns.length === 0);
  const minutes = new Map<string, number>();
  for (const turn of answered) {
    const minute = turn.at.slice(0, 16);
    minutes.set(minute, (minutes.get(minute) ?? 0) + turn.input + turn.cacheRead + turn.cacheWrite + turn.output);
  }

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
    ...(priced
      ? {
          cost: prices.reduce(
            (total, { read, price }) =>
              total + (price ? read.turns.reduce((each, turn) => each + turnCost(price, turn), 0) : 0),
            0
          )
        }
      : {}),
    minutes: [...minutes].map(([at, tokens]) => ({ at, tokens })),
    heaviest: [...heaviest.values()].sort((a, b) => b.reread - a.reread).slice(0, KEPT),
    plitziRead: [...read]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, KEPT * 2)
      .map(([file, times]) => ({ file, times }))
  };
};
