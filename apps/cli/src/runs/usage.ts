import { createHash, timingSafeEqual } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { AGENT_TOKEN } from './identity';
import { activeRunFile, COPY_TASK_FILE, copyOf, runPaths } from './paths';

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

export interface UsageLine {
  at: string;
  by: string;
  /** The command as it was run, its tokens' secrets kept out, cut. */
  command: string;
  /** What it printed, stdout and stderr: what its caller read. */
  chars: number;
  ms: number;
  code: number;
}

/** A command of a run says who ran it once it is proved (`runOf`); one run elsewhere — a page shot in a copy — by the copy. */
const caller: { runDir?: string; by?: string } = {};

export const usageCaller = (runDir: string, by: string): void => {
  caller.runDir = runDir;
  caller.by = by;
};

/** The command line as it is kept: secrets out — a task's token and an agent's — and no longer than a line. */
export const keptCommand = (args: readonly string[]): string =>
  ['plitzi', ...args]
    .join(' ')
    .replace(/(--token[ =])\S+/g, '$1…')
    .replace(/\b([a-z0-9][a-z0-9_-]*\.@?[a-z0-9][a-z0-9_-]*)\.[0-9a-f]{32,48}\b/g, '$1.…')
    .slice(0, 200);

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
 * against the digest its run keeps, so a cost is never counted as another's: velada-fidelity's designer measured for
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

/**
 * Counts what this process prints from now, and, as it exits, says it in its run's usage — when it ran in one: a
 * command outside a run is nobody's cost to count. Never fails the command: a usage line not written is only not kept.
 */
export const startUsage = (args: readonly string[], cwd: string, now: () => number = Date.now): void => {
  // A command another command of the CLI runs (`task look`'s page checks and shots) is read by that one, not an agent;
  // one at a terminal by a person — `run monitor` redrawn for an hour was 2.6M "tokens" no agent read.
  if (process.env[USAGE_OFF] === '1' || process.stdout.isTTY) {
    return;
  }

  const started = now();
  let chars = 0;
  for (const stream of [process.stdout, process.stderr]) {
    const write = stream.write.bind(stream);
    // Bound and passed through whole: only the length is read, every overload's arguments go on as they came.
    stream.write = (chunk: string | Uint8Array, ...rest: unknown[]) => {
      chars += typeof chunk === 'string' ? chunk.length : chunk.byteLength;

      return (write as (...all: unknown[]) => boolean)(chunk, ...rest);
    };
  }

  process.once('exit', code => {
    const where =
      caller.runDir && caller.by
        ? { runDir: caller.runDir, by: caller.by }
        : (tokenCaller(cwd, args) ?? runOfFolder(cwd));
    // A run gone — finished, aborted — is never made again by its last command's line.
    if (!where || !existsSync(where.runDir)) {
      return;
    }

    const line: UsageLine = {
      at: new Date(started).toISOString(),
      by: where.by,
      command: keptCommand(args),
      chars,
      ms: now() - started,
      code
    };
    try {
      appendFileSync(path.join(where.runDir, USAGE_FILE), `${JSON.stringify(line)}\n`);
    } catch {
      // Kept or not, the command's own answer stands: its cost is the only thing not counted.
    }
  });
};

const isUsageLine = (value: unknown): value is UsageLine =>
  isRecord(value) &&
  typeof value.at === 'string' &&
  typeof value.by === 'string' &&
  typeof value.command === 'string' &&
  typeof value.chars === 'number' &&
  typeof value.ms === 'number' &&
  typeof value.code === 'number';

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
 * refused as an unknown option (velada-fidelity's designer). A command that is no run's reads it for its cost alone.
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
