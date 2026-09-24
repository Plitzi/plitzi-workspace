import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';

import { linuxEsbuildBinary } from './esbuildBinary';
import { freePort, run, runCapturingAll } from './process';
import { nodeArgs, PROBE_ENTRY } from './types';
import { parseProbeOutput, PROBE_PREFIX } from '../../probe/protocol';

import type { ExitState, LaunchOptions, ResourceSample, RunningTarget, Runtime, Sampler } from './types';

const CONTAINER_PORT = 4300;
const WORKSPACE_MOUNT = '/w';
const ESBUILD_MOUNT = '/opt/esbuild';
// The plugin compiler writes here, relative to the server's cwd. A fresh volume per run also means every run
// compiles its plugins from nothing, so the start-up time measured is a cold one.
const WRITABLE_DIRS = ['.sdk-plugins'];

/**
 * One reading of the container's cgroup, printed as one line: `memory anon peak usage periods throttled`.
 *
 * Shell builtins only. It runs inside the container, so its CPU is charged to the same quota as the server's — a
 * sampler that forked `cat` four times a second would spend a measurable share of a quarter core itself.
 */
const CGROUP_READING = `
cg=/sys/fs/cgroup
read -r memory < $cg/memory.current
peak=0
if [ -r $cg/memory.peak ]; then read -r peak < $cg/memory.peak; fi
anon=0
while read -r key value; do if [ "$key" = anon ]; then anon=$value; break; fi; done < $cg/memory.stat
usage=0; periods=0; throttled=0
while read -r key value; do
  case $key in
    usage_usec) usage=$value ;;
    nr_periods) periods=$value ;;
    nr_throttled) throttled=$value ;;
  esac
done < $cg/cpu.stat
echo "$memory $anon $peak $usage $periods $throttled"
`;

// `read -t` on a pipe nothing ever writes to is a sleep that forks nothing.
const samplingLoop = (intervalMs: number): string =>
  `exec 3<> <(:)\nwhile :; do\n${CGROUP_READING}\nread -r -t ${intervalMs / 1000} -u 3 _\ndone`;

const parseReading = (line: string): ResourceSample | undefined => {
  const values = line.trim().split(' ').map(Number);
  if (values.length !== 6 || values.some(value => !Number.isFinite(value))) {
    return undefined;
  }

  const [memoryBytes, anonBytes, peakBytes, cpuUsec, periods, throttledPeriods] = values;

  return {
    memoryBytes,
    anonBytes,
    ...(peakBytes > 0 ? { peakBytes } : {}),
    cpuUsec,
    periods,
    throttledPeriods
  };
};

const dockerArch = async (): Promise<'arm64' | 'x64'> => {
  const arch = await run('docker', ['info', '--format', '{{.Architecture}}']);
  if (arch === 'aarch64' || arch === 'arm64') {
    return 'arm64';
  }

  if (arch === 'x86_64' || arch === 'amd64') {
    return 'x64';
  }

  throw new Error(`Docker runs on "${arch}", which the bench has no esbuild build for`);
};

export const createDockerRuntime = (image: string): Runtime => {
  const describe = async (): Promise<Record<string, string>> => ({
    docker: await run('docker', ['version', '--format', '{{.Server.Version}}']),
    architecture: await dockerArch(),
    image,
    node: await run('docker', ['run', '--rm', image, 'node', '--version'])
  });

  const launch = async ({
    target,
    profile,
    workspaceRoot,
    nodeOptions,
    runner,
    env: extraEnv
  }: LaunchOptions): Promise<RunningTarget> => {
    const name = `plitzi-bench-${target.name}-${process.pid}`;
    const hostPort = await freePort();
    const esbuild = await linuxEsbuildBinary(workspaceRoot, await dockerArch());
    const cwd = path.posix.join(WORKSPACE_MOUNT, target.cwd);
    // A volume can only be mounted over a directory that exists, and the workspace is mounted read-only.
    for (const dir of WRITABLE_DIRS) {
      mkdirSync(path.join(workspaceRoot, target.cwd, dir), { recursive: true });
    }

    const env: Record<string, string> = {
      NODE_ENV: 'production',
      HOST: '0.0.0.0',
      PORT: String(CONTAINER_PORT),
      ESBUILD_BINARY_PATH: ESBUILD_MOUNT,
      ...target.env,
      ...extraEnv
    };

    await run('docker', ['rm', '-f', '-v', name]).catch(() => undefined);
    await run('docker', [
      'run',
      '--detach',
      '--name',
      name,
      ...(profile.cpus === undefined ? [] : ['--cpus', String(profile.cpus)]),
      ...(profile.memoryMb === undefined
        ? []
        : ['--memory', `${profile.memoryMb}m`, '--memory-swap', `${profile.memoryMb}m`]),
      '--publish',
      `127.0.0.1:${hostPort}:${CONTAINER_PORT}`,
      ...Object.entries(env).flatMap(([key, value]) => ['--env', `${key}=${value}`]),
      '--volume',
      `${workspaceRoot}:${WORKSPACE_MOUNT}:ro`,
      '--volume',
      `${esbuild}:${ESBUILD_MOUNT}:ro`,
      ...WRITABLE_DIRS.flatMap(dir => ['--volume', path.posix.join(cwd, dir)]),
      '--workdir',
      cwd,
      image,
      'node',
      ...nodeArgs(runner, target.entry, path.posix.join(WORKSPACE_MOUNT, PROBE_ENTRY), nodeOptions)
    ]);

    const sample = async (): Promise<ResourceSample> => {
      const reading = parseReading(await run('docker', ['exec', name, 'bash', '-c', CGROUP_READING]));
      if (!reading) {
        throw new Error(`Could not read the cgroup of ${name}`);
      }

      return reading;
    };

    const sampleEvery = (intervalMs: number): Sampler => {
      const samples: ResourceSample[] = [];
      const child = spawn('docker', ['exec', name, 'bash', '-c', samplingLoop(intervalMs)], {
        stdio: ['ignore', 'pipe', 'ignore']
      });
      createInterface({ input: child.stdout }).on('line', line => {
        const reading = parseReading(line);
        if (reading) {
          samples.push(reading);
        }
      });

      return {
        stop: () => {
          child.kill();

          return samples;
        }
      };
    };

    const state = async (): Promise<ExitState> => {
      const inspected = await run('docker', [
        'inspect',
        '--format',
        '{{.State.Running}} {{.State.OOMKilled}} {{.State.ExitCode}}',
        name
      ]);
      const [running, oomKilled, exitCode] = inspected.split(' ');

      return {
        running: running === 'true',
        oomKilled: oomKilled === 'true',
        ...(running === 'true' ? {} : { exitCode: Number(exitCode) })
      };
    };

    return {
      baseUrl: `http://127.0.0.1:${hostPort}`,
      sample,
      sampleEvery,
      state,
      probe: async sinceMs =>
        parseProbeOutput(
          await runCapturingAll('docker', ['logs', '--since', new Date(sinceMs).toISOString(), name])
        ).filter(sample => sample.t >= sinceMs),
      logs: async () =>
        (await runCapturingAll('docker', ['logs', '--tail', '2000', name]))
          .split('\n')
          .filter(line => !line.includes(PROBE_PREFIX))
          .slice(-200)
          .join('\n'),
      stop: async () => {
        await run('docker', ['rm', '-f', '-v', name]);
      }
    };
  };

  return { name: 'docker', enforcesLimits: true, describe, launch };
};
