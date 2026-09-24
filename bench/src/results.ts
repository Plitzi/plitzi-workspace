import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { run } from './runtime/process';

import type { TargetResult } from './measure';
import type { Profile } from './profiles';

export type RunResult = {
  date: string;
  profile: Profile;
  runtime: { name: string; enforcesLimits: boolean; details: Record<string, string> };
  git: { commit: string; dirty: boolean };
  /** Packages taken from outside the workspace for this run, by name: what was measured was not the published one. */
  portals: Record<string, string>;
  host: { platform: string; cpu: string; cores: number; memoryGb: number };
  options: {
    concurrency: number[];
    durationMs: number;
    warmupMs: number;
    repeat: number;
    nodeOptions: string[];
    env: Record<string, string>;
  };
  targets: TargetResult[];
};

export const describeHost = (): RunResult['host'] => ({
  platform: `${process.platform}-${process.arch}`,
  cpu: os.cpus()[0]?.model ?? 'unknown',
  cores: os.cpus().length,
  memoryGb: Math.round(os.totalmem() / 1024 ** 3)
});

export const describeGit = async (workspaceRoot: string): Promise<RunResult['git']> => {
  const commit = await run('git', ['-C', workspaceRoot, 'rev-parse', '--short', 'HEAD']);
  const status = await run('git', ['-C', workspaceRoot, 'status', '--porcelain']);

  return { commit, dirty: status.length > 0 };
};

const benchDir = (workspaceRoot: string): string => path.join(workspaceRoot, 'bench');

/**
 * Where a run is kept: one file per profile and runtime, which the next run of it replaces — the date is inside — so
 * the folder holds the latest of each and never grows. Git-ignored; a run worth keeping is a baseline.
 */
export const saveResult = (workspaceRoot: string, result: RunResult): string => {
  const dir = path.join(benchDir(workspaceRoot), 'results');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${result.profile.name}-${result.runtime.name}.json`);
  writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);

  return file;
};

/** The same run as a table to read, beside its JSON. */
export const saveMarkdown = (jsonFile: string, markdown: string): string => {
  const file = jsonFile.replace(/\.json$/, '.md');
  writeFileSync(file, `${markdown}\n`);

  return file;
};

/** The overview across profiles, always at the same path so it is the one file to open. */
export const saveReport = (workspaceRoot: string, markdown: string): string => {
  const dir = path.join(benchDir(workspaceRoot), 'results');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'report.md');
  writeFileSync(file, `${markdown}\n`);

  return file;
};

/** The saved run of each profile and runtime — the latest, since each replaces the one before. */
export const latestResults = (workspaceRoot: string): RunResult[] => {
  const dir = path.join(benchDir(workspaceRoot), 'results');
  if (!existsSync(dir)) {
    return [];
  }

  const latest = new Map<string, RunResult>();
  for (const file of readdirSync(dir)
    .filter(name => name.endsWith('.json'))
    .sort()) {
    const parsed: unknown = JSON.parse(readFileSync(path.join(dir, file), 'utf-8'));
    if (isRunResult(parsed)) {
      latest.set(`${parsed.profile.name}-${parsed.runtime.name}`, parsed);
    }
  }

  return [...latest.values()];
};

/** Baselines are per profile and runtime: the same server measured under another limit is not comparable. */
export const baselinePath = (workspaceRoot: string, profile: string, runtime: string): string =>
  path.join(benchDir(workspaceRoot), 'baseline', `${profile}-${runtime}.json`);

const isRunResult = (value: unknown): value is RunResult =>
  typeof value === 'object' && value !== null && 'targets' in value && Array.isArray(value.targets);

export const readBaseline = (file: string): RunResult | undefined => {
  if (!existsSync(file)) {
    return undefined;
  }

  const parsed: unknown = JSON.parse(readFileSync(file, 'utf-8'));
  if (!isRunResult(parsed)) {
    throw new Error(`${file} is not a bench result`);
  }

  return parsed;
};

/**
 * Writes the run as the baseline, merged over the one already there by target: re-measuring one target must not
 * throw away the others' baselines.
 */
export const saveBaseline = (file: string, result: RunResult): void => {
  const previous = readBaseline(file);
  const measured = new Set(result.targets.map(target => target.target));
  const kept = previous?.targets.filter(target => !measured.has(target.target)) ?? [];
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ ...result, targets: [...kept, ...result.targets] }, null, 2)}\n`);
};
