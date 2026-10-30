import { createHash, timingSafeEqual } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { activeRunFile, COPY_TASK_FILE, copyOf, RECORD_FILE, runPaths } from './paths';
import { AGENT_TOKEN } from '../agents/identity';
import { sessionOfProcess } from '../agents/session';

import type { CommandPath } from '../../commandPath';
import type { Command } from 'commander';

/**
 * What each command of a run cost the agent that ran it — what it printed, which the agent reads as tokens, how long it
 * took, how it ended — a line each in the run's `usage.jsonl`, apart from its activity: the report reads it for the
 * cost of a run (the CLI's share of an agent's tokens), its repeated calls and its slowest, and the bench compares runs
 * by it. The harness's own tokens the lead says with the report (`run report --tokens`).
 */

export const USAGE_FILE = 'usage.jsonl';

/** Set for the CLI's own child processes: what they print is read by the command that ran them, never counted twice. */
export const USAGE_OFF = 'PLITZI_USAGE_CHILD';

export interface UsageLine extends CommandPath {
  at: string;
  by: string;
  /** The command as it was run, its tokens' secrets kept out, cut: what a person reads — never taken apart. */
  command: string;
  /** What it printed, stdout and stderr: what its caller read. */
  chars: number;
  ms: number;
  code: number;
  /** The harness session it ran in (`session.ts`): what liveness, one task a session and an agent's cost are read by. */
  session?: string;
  /** Ended other than 0: what it said was wrong, its first line — why a command failed, grouped across a run. */
  error?: string;
  /**
   * Ended other than 0: the lines of what it printed that say what failed — a check's steps, a page's console errors
   * and failed requests, a refusal and its way out — for whoever fixes it to read without running it again.
   */
  output?: string[];
  /** The harness process it ran under, `<program>:<pid>:<started>`, when its sessions are kept by its own id. */
  process?: string;
  /**
   * What its answer is made of, in characters, as the command says it (`answerParts`): a run's `task next` answered 15k
   * three runs running, and which part was heavy was guessed — the brief's imports, 5.7k of it.
   */
  parts?: Record<string, number>;
}

/** What this command's answer is made of, as it said it: kept on its usage line. */
let partsSaid: Record<string, number> | undefined;

/** Said by a command whose answer is made of parts — a brief, a review handed — what each weighs, in characters. */
export const answerParts = (parts: Record<string, number>): void => {
  partsSaid = { ...partsSaid, ...Object.fromEntries(Object.entries(parts).filter(([, size]) => size > 0)) };
};

/** How much of what a command printed is kept to say why it failed: its start and its end, where that is said. */
const KEPT_OUTPUT = 4000;

/** Lines of a failure's output that say what failed, by what they start with or say. */
const SAYS_FAILED =
  /✗|\b(error|failed|fails|refused|cannot|not on the page|console|timed? ?out|exception)\b|\b\w+Error\b|\b[45]\d\d\b/i;

/** A test runner's line for one test that failed: node's `✖ name`, TAP's `not ok 3 - name`, vitest's `× name`. */
const TEST_FAILED = /^\s*(✖|×|not ok\b|FAIL\b)/;

/** How many of a failure's lines are kept. */
const OUTPUT_LINES = 15;

/** How much of what a command wrote to stderr is kept to say why it failed: its start is where it says so. */
const KEPT_STDERR = 4000;

/** A command of a run says who ran it once it is proved (`runOf`); one run elsewhere — a page shot in a copy — by the copy. */
const caller: { runDir?: string; by?: string } = {};

export const usageCaller = (runDir: string, by: string): void => {
  caller.runDir = runDir;
  caller.by = by;
};

/** A text as a run keeps it: a token passed (`--token`) and an agent's token's secret cut. */
const withoutSecrets = (text: string): string =>
  text
    .replace(/(--token[ =])\S+/g, '$1…')
    .replace(/\b([a-z0-9][a-z0-9_-]*\.@?[a-z0-9][a-z0-9_-]*)\.[0-9a-f]{32,48}\b/g, '$1.…');

/** The command line as it is kept: secrets out — a task's token and an agent's — and no longer than a line. */
export const keptCommand = (args: readonly string[]): string =>
  withoutSecrets(['plitzi', ...args].join(' ')).slice(0, 200);

/**
 * Why a command that failed failed, in a line: the line that says it is an error (commander's `error: …`, a `✗`, a
 * refusal), else its first — secrets cut as its command's are.
 */
export const errorLine = (stderr: string): string | undefined => {
  const said = stderr
    .split('\n')
    // Colours are how a terminal shows it, not what it says.
    // eslint-disable-next-line no-control-regex
    .map(line => line.replace(/\x1b\[[0-9;]*m/g, '').trim())
    .filter(line => line !== '' && !line.startsWith('·'));
  const line = said.find(each => /^(error\b|✗|refused\b)|\b(Error|refused|cannot|is not)\b/.test(each)) ?? said.at(0);

  return line === undefined ? undefined : withoutSecrets(line).slice(0, 200);
};

/**
 * The lines of a failed command's output worth reading again: those that say what failed, else its last ones —
 * colours left out, secrets cut, each no longer than a line.
 */
export const failureLines = (output: string): string[] => {
  const lines = output
    .split('\n')
    // eslint-disable-next-line no-control-regex
    .map(line => withoutSecrets(line.replace(/\x1b\[[0-9;]*m/g, '').trimEnd()).slice(0, 240))
    .filter(line => line.trim() !== '' && !line.trim().startsWith('·'));
  // A test runner's own line for a test that failed names it — `✖ the night counts to the millisecond` — where the rest
  // of what it printed is a diff's fragments (a run's dev-2 read those alone): its names first.
  const tests = lines.filter(line => TEST_FAILED.test(line));
  const failed = lines.filter(line => SAYS_FAILED.test(line) && !TEST_FAILED.test(line));

  return (tests.length + failed.length > 0 ? [...tests, ...failed] : lines.slice(-OUTPUT_LINES)).slice(0, OUTPUT_LINES);
};

const readJsonSync = (file: string): unknown => {
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as unknown;
  } catch {
    return undefined;
  }
};

/** The token a command was given (`--token`, `PLITZI_TOKEN`), whatever the command: what its cost is counted as. */
const tokenSaid = (args: readonly string[]): string | undefined => {
  const at = args.findIndex(arg => arg === '--token' || arg.startsWith('--token='));
  const said = at < 0 ? process.env.PLITZI_TOKEN : args[at].startsWith('--token=') ? args[at].slice(8) : args[at + 1];

  return said?.trim() || undefined;
};

/**
 * Who an agent's token says ran a command no run's context proved — `page measure`, `page shot`, `lint` — checked
 * against the digest its run keeps, so a cost is never counted as another's: a run's designer measured for
 * minutes and none of it was in the usage, every line "unnamed" or missing.
 */
const tokenCaller = (cwd: string, args: readonly string[]): { runDir: string; by: string } | undefined => {
  const [, run, agent, secret] = AGENT_TOKEN.exec(tokenSaid(args) ?? '') ?? [];
  if (!run || !agent || !secret) {
    return undefined;
  }

  const root = copyOf(cwd)?.root ?? cwd;
  const paths = runPaths(root, run);
  const identity = readJsonSync(path.join(paths.identities, `${agent}.json`));
  const kept =
    isRecord(identity) && typeof identity.digest === 'string' ? Buffer.from(identity.digest, 'hex') : undefined;
  const given = createHash('sha256').update(secret).digest();

  return kept && kept.length === given.length && timingSafeEqual(kept, given)
    ? { runDir: paths.dir, by: agent }
    : undefined;
};

/** Where a command not proved by a run's context belongs: the copy it ran in, or the project's open run, unnamed. */
const runOfFolder = (cwd: string): { runDir: string; by: string } | undefined => {
  const copy = copyOf(cwd);
  if (copy) {
    const task = readJsonSync(path.join(cwd, COPY_TASK_FILE));

    return {
      runDir: runPaths(copy.root, copy.run).dir,
      by: isRecord(task) && typeof task.agent === 'string' ? task.agent : copy.task
    };
  }

  const active = readJsonSync(activeRunFile(cwd));

  return isRecord(active) && typeof active.runId === 'string'
    ? { runDir: runPaths(cwd, active.runId).dir, by: 'unnamed' }
    : undefined;
};

/** A command that hands no messages over: anything but a task's or a run's, which read the inbox themselves. */
const isInboxless = (args: readonly string[]): boolean => !['task', 'run'].includes(args[0] ?? '');

/**
 * What was said to `agent` by name and it has not read — none for the lead or an unnamed caller — handed over whole and
 * marked read: a page command reads no inbox, and a count pointing at it went unread (a scout heard the lead's
 * "where do you stand?" fifteen times over, only at its next `task next`, its page commands between pointing at it).
 */
export const handUnreadByName = (runDir: string, agent: string): { id: string; from: string; text: string }[] => {
  if (agent === 'lead' || agent === 'unnamed') {
    return [];
  }

  const readFile = path.join(runDir, 'agents-read', `${agent}.json`);
  const read = readJsonSync(readFile);
  const seen = Array.isArray(read) ? read.filter((id): id is string => typeof id === 'string') : [];
  let names: string[];
  try {
    names = readdirSync(path.join(runDir, 'messages')).filter(name => name.endsWith('.json'));
  } catch {
    return [];
  }

  const unread = names
    .map(name => readJsonSync(path.join(runDir, 'messages', name)))
    .flatMap(message =>
      isRecord(message) &&
      message.to === `@${agent}` &&
      typeof message.id === 'string' &&
      typeof message.from === 'string' &&
      typeof message.text === 'string' &&
      !seen.includes(message.id)
        ? [{ id: message.id, from: message.from, text: message.text, at: String(message.at) }]
        : []
    )
    .sort((a, b) => a.at.localeCompare(b.at));
  if (unread.length > 0) {
    try {
      mkdirSync(path.dirname(readFile), { recursive: true });
      writeFileSync(readFile, `${JSON.stringify([...seen, ...unread.map(each => each.id)])}\n`);
    } catch {
      // Not marked, it is handed again with the next command: said twice, never lost.
    }
  }

  return unread.map(({ id, from, text }) => ({ id, from, text }));
};

/** Whether a run's folder still holds its run: its record there — not a folder a finish is removing. */
export const runStillThere = (runDir: string): boolean => existsSync(path.join(runDir, RECORD_FILE));

/** The command this process runs, as the program reads it: kept for its usage line and its run's log. */
let ran: CommandPath = { name: '', options: [], args: [] };

export const ranCommand = (): CommandPath => ran;

/** Its arguments as a run keeps them: secrets out, each no longer than a line. */
const keptPath = (command: CommandPath): CommandPath => ({
  ...command,
  args: command.args.map(arg => withoutSecrets(arg).slice(0, 120))
});

/**
 * Counts what this process prints from now, and, as it exits, says it in its run's usage — when it ran in one: a
 * command outside a run is nobody's cost to count. Never fails the command: a usage line not written is only not kept.
 */
export const startUsage = (
  args: readonly string[],
  cwd: string,
  command: CommandPath,
  now: () => number = Date.now
): void => {
  ran = keptPath(command);
  // A command another command of the CLI runs (`task look`'s page checks and shots) is read by that one, not an agent;
  // one at a terminal by a person — `run monitor` redrawn for an hour was 2.6M "tokens" no agent read.
  if (process.env[USAGE_OFF] === '1' || process.stdout.isTTY) {
    return;
  }

  const started = now();
  let chars = 0;
  let stderr = '';
  // Both streams, as the caller read them: the start kept whole, the end as it last was.
  let head = '';
  let tail = '';
  for (const stream of [process.stdout, process.stderr]) {
    const write = stream.write.bind(stream);
    // Bound and passed through whole: only the length is read, every overload's arguments go on as they came.
    stream.write = (chunk: string | Uint8Array, ...rest: unknown[]) => {
      chars += typeof chunk === 'string' ? chunk.length : chunk.byteLength;
      const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');
      if (stream === process.stderr && stderr.length < KEPT_STDERR) {
        stderr += text.slice(0, KEPT_STDERR);
      }

      if (head.length < KEPT_OUTPUT) {
        head += text.slice(0, KEPT_OUTPUT - head.length);
      } else {
        tail = (tail + text).slice(-KEPT_OUTPUT);
      }

      return (write as (...all: unknown[]) => boolean)(chunk, ...rest);
    };
  }

  process.once('exit', code => {
    const where =
      caller.runDir && caller.by
        ? { runDir: caller.runDir, by: caller.by }
        : (tokenCaller(cwd, args) ?? runOfFolder(cwd));
    // A run gone — finished, aborted — is never made again by its last command's line, nor one being removed: a command
    // of an agent still running wrote its line into a finish's half-removed folder, and the removal failed on it.
    if (!where || !runStillThere(where.runDir)) {
      return;
    }

    // A page command reads no inbox: what was said to its agent meanwhile — a review withdrawn under it — is pointed
    // at here (design-2 measured a withdrawn review on and was refused three times on its verdict).
    const { session, process: harness } = sessionOfProcess();
    const error = code === 0 ? undefined : errorLine(stderr);
    const output = code === 0 ? [] : failureLines(`${head}\n${tail}`);
    // Said after what failed is read: a message is never taken for the command's error.
    for (const message of isInboxless(args) ? handUnreadByName(where.runDir, where.by) : []) {
      process.stderr.write(`✉ ${message.from} (${message.id}): ${message.text}\n`);
    }

    const line: UsageLine = {
      at: new Date(started).toISOString(),
      by: where.by,
      command: keptCommand(args),
      ...ran,
      chars,
      ms: now() - started,
      code,
      ...(session ? { session } : {}),
      ...(harness ? { process: harness } : {}),
      ...(error ? { error } : {}),
      ...(output.length > 0 ? { output } : {}),
      ...(partsSaid && Object.keys(partsSaid).length > 0 ? { parts: partsSaid } : {})
    };
    try {
      appendFileSync(path.join(where.runDir, USAGE_FILE), `${JSON.stringify(line)}\n`);
    } catch {
      // Kept or not, the command's own answer stands: its cost is the only thing not counted.
    }
  });
};

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(each => typeof each === 'string');

const isUsageLine = (value: unknown): value is UsageLine =>
  isRecord(value) &&
  typeof value.at === 'string' &&
  typeof value.by === 'string' &&
  typeof value.command === 'string' &&
  typeof value.name === 'string' &&
  isStrings(value.options) &&
  isStrings(value.args) &&
  typeof value.chars === 'number' &&
  typeof value.ms === 'number' &&
  typeof value.code === 'number' &&
  (value.session === undefined || typeof value.session === 'string') &&
  (value.error === undefined || typeof value.error === 'string') &&
  (value.process === undefined || typeof value.process === 'string') &&
  (value.output === undefined || (Array.isArray(value.output) && value.output.every(line => typeof line === 'string')));

/** A run's usage, as its commands kept it — a line cut by a crash mid-write left out. */
export const readUsage = (runDir: string): UsageLine[] => {
  try {
    return readFileSync(path.join(runDir, USAGE_FILE), 'utf-8')
      .split('\n')
      .filter(Boolean)
      .flatMap(text => {
        try {
          const parsed: unknown = JSON.parse(text);

          return isUsageLine(parsed) ? [parsed] : [];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
};

/**
 * Every command takes `--token`, not only a run's: the protocol is to pass it on each, and `page measure --token` was
 * refused as an unknown option (a run's designer). A command that is no run's reads it for its cost alone.
 */
export const acceptTokenEverywhere = (command: Command): void => {
  for (const sub of command.commands) {
    if (sub.commands.length > 0) {
      acceptTokenEverywhere(sub);
    } else if (!sub.options.some(option => option.long === '--token')) {
      sub.option(
        '--token <token>',
        'Your token, in a run: what this command cost is counted as yours (or PLITZI_TOKEN)'
      );
    }
  }
};
