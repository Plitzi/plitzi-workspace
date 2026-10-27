import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { runsSuite, SUITE_LOCK, suiteScripts } from './acceptance';
import { runScript, tail } from '../../commands/project/verify';
import { withLock } from '../core/store';
import { loadRun } from '../run';
import { readInbox } from '../talk/talk';

import type { RunContext } from '../run';
import type { Message } from '../talk/messages';

/**
 * `plitzi task run "<command>"`: a command of an agent's own — a spec, a probe, a test file — run as the run's own
 * checks are. A Playwright suite waits its turn on the machine (`SUITE_LOCK`: a run's scout-3 could not tell whether
 * another agent's held it); what it prints goes to a file, and the agent reads what failed and its end (a whole
 * Playwright report read into an agent's context is read again on every later turn); and what the lead said meanwhile
 * comes with it (a run's scout-1, at probes of its own for minutes, heard the lead 2.5 min late).
 */

/** How long a command of an agent's own waits for another agent's suite: a harness stops a command at about ten. */
const SUITE_WAIT_MS = 8 * 60_000;

export interface OwnCommandRun {
  command: string;
  code: number;
  ms: number;
  /** What it printed that says what failed, and its end (`tail`). */
  lines: string[];
  /** All it printed, its lines counted. */
  log: string;
  printed: number;
  /** It ran a Playwright suite: in its turn on the machine. */
  suite: boolean;
  /** What was said to the agent and it had not read. */
  messages: Message[];
}

export const runOwnCommand = async (
  ctx: RunContext,
  runId: string,
  command: string,
  {
    task,
    onWait,
    lock = SUITE_LOCK
  }: {
    /** The task its token holds, if any: what was said to it comes with the result. */
    task?: string;
    onWait?: (since: string | undefined) => void;
    /** The machine's suite lock — a test's own, so as never to hold a real run's suite. */
    lock?: string;
  } = {}
): Promise<OwnCommandRun> => {
  await loadRun(ctx, runId, { anyVersion: true });
  const cwd = ctx.cwd ?? process.cwd();
  const suite = runsSuite(command, await suiteScripts(ctx.root));
  const started = Date.now();
  const run = (): Promise<{ code: number; output: string }> => runScript(cwd, command, ctx.root);
  const { code, output } = suite
    ? await withLock(lock, run, {
        ttlMs: 30 * 60_000,
        waitMs: SUITE_WAIT_MS,
        doing: "another agent's Playwright suite on this machine",
        ...(onWait ? { onWait } : {})
      })
    : await run();
  const ms = Date.now() - started;
  // Out of the project and its copies: the project's tmp/ is the person's, and the run's scratch goes to its report.
  const dir = path.join(os.tmpdir(), 'plitzi-task-run', runId, ctx.agent);
  await fs.mkdir(dir, { recursive: true });
  const log = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
  await fs.writeFile(log, output);

  return {
    command,
    code,
    ms,
    lines: tail(output),
    log,
    printed: output.split('\n').length,
    suite,
    messages: await readInbox(ctx, runId, task)
  };
};
