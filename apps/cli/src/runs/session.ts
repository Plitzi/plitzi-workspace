import { execFileSync } from 'node:child_process';
import path from 'node:path';

/**
 * Which session of its harness a command ran in — what a run reads liveness, "one task a session" and an agent's cost
 * by. A run read them off its log alone: 556 commands ran after their agent's `stops` with no start logged, and the
 * CLI took agents long gone for running (#27, #44, #49). A session the CLI started says it (`PLITZI_SESSION`); one a
 * harness started says its own (Claude Code's `CLAUDE_CODE_SESSION_ID`); any other is the harness process the command
 * runs under, by its pid and when it started.
 */

/** Set by `run agent --launch` for the harness it starts, and so for every command the agent runs. */
export const SESSION_ENV = 'PLITZI_SESSION';

/** What each harness says its session is, where it says one. */
const HARNESS_SESSION_ENV = ['CLAUDE_CODE_SESSION_ID'] as const;

/** The harnesses a command is looked for under, by the name of the program they run as. */
const HARNESS_PROGRAMS = new Set(['claude', 'codex', 'opencode']);

const ROW = /^\s*(\d+)\s+(\d+)\s+(\w{3} \w{3}\s+\d+ [\d:]+ \d{4})\s+(.*)$/;

/** The harness process above this one, as `<program>:<pid>:<started>` — or nothing when none is. */
const harnessAbove = (): string | undefined => {
  if (process.platform === 'win32') {
    return undefined;
  }

  let table: string;
  try {
    table = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,lstart=,args='], { encoding: 'utf-8', timeout: 2000 });
  } catch {
    return undefined;
  }

  const rows = new Map<number, { parent: number; started: string; args: string }>();
  for (const line of table.split('\n')) {
    const [, pid, parent, started, args] = ROW.exec(line) ?? [];
    if (pid && parent && started) {
      rows.set(Number(pid), { parent: Number(parent), started, args });
    }
  }

  // A harness run by node (`node …/claude`) is named by its script, one run as itself by its program.
  for (let pid = process.ppid, depth = 0; pid > 1 && depth < 20; depth += 1) {
    const row = rows.get(pid);
    if (!row) {
      return undefined;
    }

    const program = row.args
      .split(' ')
      .slice(0, 2)
      .map(part => path.basename(part))
      .find(name => HARNESS_PROGRAMS.has(name));
    if (program) {
      return `${program}:${String(pid)}:${String(Date.parse(row.started) / 1000)}`;
    }

    pid = row.parent;
  }

  return undefined;
};

const said = (name: string): string | undefined => process.env[name]?.trim() || undefined;

/**
 * The session this command runs in — or nothing when it runs in none a run can tell (a person's terminal) — and, for a
 * harness that keeps its sessions under its own id (Codex, OpenCode), the harness process it runs under: what its spend
 * is found by (`harness/`). Claude Code says its session itself, and needs no look at the processes.
 */
export const sessionOfProcess = (): { session?: string; process?: string } => {
  const claude = HARNESS_SESSION_ENV.map(said).find(each => each !== undefined);
  const above = claude === undefined ? harnessAbove() : undefined;
  const session = said(SESSION_ENV) ?? claude ?? above;

  return { ...(session ? { session } : {}), ...(above ? { process: above } : {}) };
};
