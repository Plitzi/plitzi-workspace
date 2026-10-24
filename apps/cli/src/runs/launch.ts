import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { isHarness } from './agentPrompt';
import { agentScratch } from './paths';
import { DEFAULTS } from './taskStore';

import type { Harness } from './agentPrompt';
import type { RunPaths } from './paths';

/**
 * What `run agent --launch` keeps of an agent it started, beside its prompt (`scratch/<agent>/agent.json`): its process,
 * when, and — in a harness that keeps one — its session, so the agent started again after it died resumes it. encore: the
 * machine went down with four agents mid-task; each was started again on a fresh session and read its task anew.
 */
export interface Launch {
  pid: number;
  harness: Harness;
  startedAt: string;
  log: string;
  /** The harness's session (`claude --session-id`): what `--resume` continues. */
  session?: string;
}

const launchFile = (paths: RunPaths, agent: string): string => path.join(agentScratch(paths, agent), 'agent.json');

const isLaunch = (value: unknown): value is Launch =>
  isRecord(value) &&
  typeof value.pid === 'number' &&
  isHarness(value.harness) &&
  typeof value.startedAt === 'string' &&
  typeof value.log === 'string' &&
  (value.session === undefined || typeof value.session === 'string');

/** The agent's last launch, as `run agent --launch` kept it — none when it was never launched, or the file is not one. */
export const readLaunch = async (paths: RunPaths, agent: string): Promise<Launch | undefined> => {
  const value: unknown = await fs
    .readFile(launchFile(paths, agent), 'utf-8')
    .then(text => JSON.parse(text) as unknown)
    .catch(() => undefined);

  return isLaunch(value) ? value : undefined;
};

export const writeLaunch = (paths: RunPaths, agent: string, launch: Launch): Promise<void> =>
  fs.writeFile(launchFile(paths, agent), `${JSON.stringify(launch, null, 2)}\n`);

/** Every process's command line by its pid, read off `ps` once — none where there is no `ps` to ask (Windows). */
export const processTable = (): Map<number, string> | undefined => {
  const read = spawnSync('ps', ['-A', '-o', 'pid=,command='], { encoding: 'utf-8' });
  if (read.status !== 0 || read.error) {
    return undefined;
  }

  return new Map(
    read.stdout.split('\n').flatMap(line => {
      const match = /^\s*(\d+)\s+(.*)$/.exec(line);

      return match ? [[Number(match[1]), match[2]] as const] : [];
    })
  );
};

/**
 * Whether the launch's process still runs, as the harness it started: a pid alone could be another process's by now,
 * so its command line must name the harness. Read off the process table; with none, a live pid is taken as it.
 */
export const isRunning = (launch: Launch, table: Map<number, string> | undefined = processTable()): boolean => {
  if (!table) {
    try {
      process.kill(launch.pid, 0);

      return true;
    } catch {
      return false;
    }
  }

  return table.get(launch.pid)?.split(/[\s/]/).includes(launch.harness) ?? false;
};

/** Whether the launch was this recent: an agent just started has said nothing yet, and is no silent one. */
export const startedWithin = (launch: Launch, now: Date, ms: number): boolean =>
  now.getTime() - Date.parse(launch.startedAt) < ms;

/**
 * Where Claude Code keeps a session of a project: `projects/<the folder, every character but a letter or digit a dash>/
 * <session>.jsonl`, under its config folder (`CLAUDE_CONFIG_DIR`, `~/.claude` when not set).
 */
export const claudeSessionFile = (root: string, session: string): string =>
  path.join(
    process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude'),
    'projects',
    root.replace(/[^a-zA-Z0-9]/g, '-'),
    `${session}.jsonl`
  );

/** Why an agent started again is on a fresh session, not its own — or nothing, when it resumes. */
export type NoResume = 'not-asked' | 'harness' | 'no-session' | 'not-mid-task' | 'gone' | 'too-large';

/**
 * Whether the agent, started again, resumes its last session: the team asks it (`resumeSession`), its harness keeps one
 * (Claude Code), it died with a task in hand — at work on it, its last word not a stop — and the session is there and
 * small enough to read again for less than starting over (`DEFAULTS.resumeMaxBytes`).
 */
export const resumable = async (
  root: string,
  launch: Launch | undefined,
  { asked, harness, midTask }: { asked: boolean; harness: Harness; midTask: boolean }
): Promise<{ session: string } | { not: NoResume; bytes?: number }> => {
  if (!asked) {
    return { not: 'not-asked' };
  }

  if (harness !== 'claude') {
    return { not: 'harness' };
  }

  if (launch?.session === undefined || launch.harness !== 'claude') {
    return { not: 'no-session' };
  }

  if (!midTask) {
    return { not: 'not-mid-task' };
  }

  const stat = await fs.stat(claudeSessionFile(root, launch.session)).catch(() => undefined);
  if (!stat) {
    return { not: 'gone' };
  }

  return stat.size > DEFAULTS.resumeMaxBytes ? { not: 'too-large', bytes: stat.size } : { session: launch.session };
};
