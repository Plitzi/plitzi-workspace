import fs from 'node:fs/promises';
import path from 'node:path';

import { agentScratch } from './paths';

import type { RunPaths } from './paths';

/**
 * Who is still there: an agent waiting for work writes nothing to the run's log — a wait is said once — so the log
 * tells a live agent from one whose harness stopped it by nothing. Each call of `task next`, and each turn of its
 * `--follow`, marks the agent present, in its scratch; the monitor reads it. velada-dress's agents, stopped by their
 * harness, still read "working" and "waiting".
 */

const PRESENCE_FILE = '.present';

/** Past this with no mark, an agent between tasks is no longer there: a `--follow` marks it every few seconds. */
export const PRESENCE_STALE_MS = 2 * 60_000;

export const markPresent = async (paths: RunPaths, agent: string, at: Date): Promise<void> => {
  const dir = agentScratch(paths, agent);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, PRESENCE_FILE), at.toISOString());
};

/** When the agent was last marked present, if ever. */
export const presentAt = async (paths: RunPaths, agent: string): Promise<number | undefined> => {
  const text = await fs.readFile(path.join(agentScratch(paths, agent), PRESENCE_FILE), 'utf-8').catch(() => undefined);
  const at = text === undefined ? Number.NaN : Date.parse(text);

  return Number.isNaN(at) ? undefined : at;
};
