import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { activeRunFile, COPY_TASK_FILE, copyOf, runPaths } from './paths';

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
  // A command another command of the CLI runs (`task look`'s page checks and shots) is read by that one, not an agent.
  if (process.env[USAGE_OFF] === '1') {
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
    const where = caller.runDir && caller.by ? { runDir: caller.runDir, by: caller.by } : runOfFolder(cwd);
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
