import { spawn } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';

import { freePort, run } from './process';
import { nodeArgs, PROBE_ENTRY } from './types';
import { parseProbeOutput } from '../../probe/protocol';

import type { ExitState, LaunchOptions, ResourceSample, RunningTarget, Runtime, Sampler } from './types';
import type { ProbeSample } from '../../probe/protocol';

/** `ps` CPU time — `[[dd-]hh:]mm:ss[.cc]` — in microseconds. */
export const parseCpuTime = (value: string): number => {
  const [days, clock] = value.includes('-') ? value.split('-') : ['0', value];
  const parts = clock.split(':').map(Number);
  const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, ...parts];

  return Math.round(((Number(days) * 24 + hours) * 3600 + minutes * 60 + seconds) * 1_000_000);
};

type ProcessRow = { pid: number; ppid: number; rssKb: number; cpuUsec: number };

const listProcesses = async (): Promise<ProcessRow[]> => {
  const output = await run('ps', ['-A', '-o', 'pid=,ppid=,rss=,time=']);

  return output.split('\n').map(line => {
    const [pid, ppid, rss, time] = line.trim().split(/\s+/);

    return { pid: Number(pid), ppid: Number(ppid), rssKb: Number(rss), cpuUsec: parseCpuTime(time) };
  });
};

/** The server and everything it started — tsx runs esbuild as a child, and that memory is the server's too. */
export const sumProcessTree = (rows: ProcessRow[], rootPid: number): { rssKb: number; cpuUsec: number } => {
  const children = new Map<number, ProcessRow[]>();
  for (const row of rows) {
    children.set(row.ppid, [...(children.get(row.ppid) ?? []), row]);
  }

  const root = rows.find(row => row.pid === rootPid);
  const pending = root ? [root] : [];
  const total = { rssKb: 0, cpuUsec: 0 };
  while (pending.length > 0) {
    const row = pending.pop();
    if (row) {
      total.rssKb += row.rssKb;
      total.cpuUsec += row.cpuUsec;
      pending.push(...(children.get(row.pid) ?? []));
    }
  }

  return total;
};

/**
 * The server as a plain child process: no limits, and memory read as resident set size, which on macOS counts shared
 * pages a container would not. For quick before/after comparisons on one machine, never for sizing hardware.
 */
export const createLocalRuntime = (): Runtime => {
  const describe = (): Promise<Record<string, string>> =>
    Promise.resolve({ node: process.version, platform: `${process.platform}-${process.arch}` });

  const launch = async ({
    target,
    workspaceRoot,
    nodeOptions,
    runner,
    env: extraEnv
  }: LaunchOptions): Promise<RunningTarget> => {
    const port = await freePort();
    const child = spawn('node', nodeArgs(runner, target.entry, path.join(workspaceRoot, PROBE_ENTRY), nodeOptions), {
      cwd: path.join(workspaceRoot, target.cwd),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: String(port),
        ...target.env,
        ...extraEnv
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const output: string[] = [];
    const probeSamples: ProbeSample[] = [];
    const keep = (line: string): void => {
      const samples = parseProbeOutput(line);
      if (samples.length > 0) {
        probeSamples.push(...samples);

        return;
      }

      output.push(line);
      output.splice(0, Math.max(0, output.length - 200));
    };
    createInterface({ input: child.stdout }).on('line', keep);
    createInterface({ input: child.stderr }).on('line', keep);

    const rootPid = child.pid;
    if (rootPid === undefined) {
      throw new Error(`Could not start ${target.name}`);
    }

    const sample = async (): Promise<ResourceSample> => {
      const { rssKb, cpuUsec } = sumProcessTree(await listProcesses(), rootPid);

      return { memoryBytes: rssKb * 1024, cpuUsec };
    };

    const sampleEvery = (intervalMs: number): Sampler => {
      const samples: ResourceSample[] = [];
      const timer = setInterval(() => {
        void sample()
          .then(reading => samples.push(reading))
          .catch(() => undefined);
      }, intervalMs);

      return {
        stop: () => {
          clearInterval(timer);

          return samples;
        }
      };
    };

    const state = (): Promise<ExitState> =>
      Promise.resolve({
        running: child.exitCode === null && child.signalCode === null,
        oomKilled: false,
        ...(child.exitCode === null ? {} : { exitCode: child.exitCode })
      });

    return {
      baseUrl: `http://127.0.0.1:${port}`,
      sample,
      sampleEvery,
      state,
      probe: sinceMs => Promise.resolve(probeSamples.filter(sample => sample.t >= sinceMs)),
      logs: () => Promise.resolve(output.join('\n')),
      stop: () =>
        new Promise(resolve => {
          if (child.exitCode !== null || child.signalCode !== null) {
            resolve();

            return;
          }

          child.once('exit', () => resolve());
          child.kill('SIGTERM');
        })
    };
  };

  return { name: 'local', enforcesLimits: false, describe, launch };
};
