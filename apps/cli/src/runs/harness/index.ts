import { readClaude } from './claude';
import { sessionOfProcess } from '../session';
import { readCodex } from './codex';
import { readOpenCode } from './opencode';
import { usageOf } from './types';

import type { HarnessUsage, SessionRead } from './types';

export { kindOf } from './types';
export type { HarnessName, HarnessUsage } from './types';

/**
 * What an agent's harness spent, read from the sessions it keeps on this machine — the cost the CLI's own count (what it
 * printed) leaves out: a run's dev-1 printed ~100k characters and its harness read 30.9M tokens, every turn reading
 * its whole context again. Read for a window of time (a task's round, the lead's run), never sent anywhere: kept in the
 * run's own report as numbers, the model it ran on, and the names of the tools and Plitzi's files it read.
 *
 * Claude Code's sessions by their id; Codex's and OpenCode's by the harness process a command ran under
 * (`<program>:<pid>:<started>`, `session.ts`) and the project's folder. Another harness's is said as not read, never
 * guessed.
 */
export const harnessUsage = async ({
  sessions,
  processes,
  root,
  from,
  to
}: {
  sessions: readonly string[];
  processes: readonly string[];
  root: string;
  from: string;
  to: string;
}): Promise<HarnessUsage | undefined> => {
  const byProcess = processes.map(each => {
    const [program, , started] = each.split(':');

    return { program, startedAt: Number(started) * 1000 };
  });
  const reads = await Promise.all([
    ...sessions.map(session => readClaude(session, from, to)),
    ...byProcess.map(({ program, startedAt }) =>
      program === 'codex'
        ? readCodex(startedAt, root, from, to)
        : program === 'opencode'
          ? readOpenCode(startedAt, root, from, to)
          : Promise.resolve(undefined)
    )
  ]);

  return usageOf(reads.filter((read): read is SessionRead => read !== undefined));
};

/**
 * How many tokens the harness session this command runs in holds now: its last turn's context. Nothing when the session
 * is not one a run reads (a person's terminal, a harness other than Claude Code, Codex and OpenCode).
 */
export const contextNow = async (root: string, now: Date): Promise<number | undefined> => {
  const { session, process } = sessionOfProcess();
  const usage = await harnessUsage({
    sessions: session === undefined ? [] : [session],
    processes: process === undefined ? [] : [process],
    root,
    from: new Date(0).toISOString(),
    to: now.toISOString()
  });

  return usage?.contextAtEnd;
};

/**
 * What the harness spent from `from` to `to` in the sessions named, and in the one this command runs in — a command's
 * own usage is written once it ends, so the session of the command that ends a piece of work is not among them yet.
 */
export const spentIn = async (
  root: string,
  window: { from: string; to: string; sessions: string[]; processes: string[] }
): Promise<HarnessUsage | undefined> => {
  const own = sessionOfProcess();

  return harnessUsage({
    sessions: [...new Set([...window.sessions, ...(own.session === undefined ? [] : [own.session])])],
    processes: [...new Set([...window.processes, ...(own.process === undefined ? [] : [own.process])])],
    root,
    from: window.from,
    to: window.to
  });
};
