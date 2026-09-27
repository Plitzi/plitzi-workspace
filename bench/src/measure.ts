import { setTimeout as sleep } from 'node:timers/promises';

import { createLoadAgent, runLoad, waitUntilReady } from './load';
import { round, summarizeLatencies } from './stats';

import type { Scenario } from './load';
import type { Profile } from './profiles';
import type { ResourceSample, RunningTarget, Runtime } from './runtime/types';
import type { LatencySummary } from './stats';
import type { Target } from './targets';
import type { ProbeSample } from '../probe/protocol';

export type MeasureOptions = {
  workspaceRoot: string;
  concurrency: number[];
  durationMs: number;
  warmupMs: number;
  nodeOptions: string[];
  env: Record<string, string>;
};

export type PhaseResult = {
  scenario: string;
  concurrency: number;
  requests: number;
  rps: number;
  /** Requests that got no HTTP answer: refused, reset or timed out. */
  errors: number;
  unexpected: Record<number, number>;
  bytesPerResponse: number;
  latencyMs: LatencySummary;
  /** CPU the server spent per answered request, every thread and child process included. */
  cpuMsPerRequest: number;
  /** Cores the server kept busy, on average. */
  cpuCores: number;
  /** Share of scheduler periods that ended with the quota spent — how often the server was made to wait. */
  throttledShare?: number;
  memoryMb: { mean: number; max: number; anonMax?: number };
  /** The process's own view, from the probe: the V8 heap, its compiled code, and memory held outside the heap. */
  processMb?: ProcessMemory;
};

export type ProcessMemory = { heapUsed: number; heapTotal: number; codeSpace: number; external: number };

export type TargetResult = {
  target: string;
  status: 'ok' | 'failed';
  failure?: string;
  /** From asking for the server to it answering its first page: process start, imports, first render. */
  bootMs?: number;
  idleMb?: number;
  idleAnonMb?: number;
  idleProcessMb?: ProcessMemory;
  phases: PhaseResult[];
  /** Memory once the load is over and the server had a moment to settle — what the traffic left behind. */
  retainedMb?: number;
  peakMb?: number;
  oomKilled: boolean;
  logsTail?: string;
};

const SETTLE_MS = 2_000;
const SAMPLE_INTERVAL_MS = 250;
const BOOT_TIMEOUT_MS = 180_000;

const mb = (bytes: number): number => round(bytes / 1048576);

/** The highest of each figure across the samples: what the phase needed at its worst. */
const processPeak = (samples: ProbeSample[]): ProcessMemory | undefined => {
  if (samples.length === 0) {
    return undefined;
  }

  const peak = (read: (sample: ProbeSample) => number) => mb(Math.max(...samples.map(read)));

  return {
    heapUsed: peak(sample => sample.heapUsed),
    heapTotal: peak(sample => sample.heapTotal),
    codeSpace: peak(sample => sample.codeSpace),
    external: peak(sample => sample.external)
  };
};

const phaseResult = (
  scenario: Scenario,
  concurrency: number,
  load: Awaited<ReturnType<typeof runLoad>>,
  before: ResourceSample,
  after: ResourceSample,
  samples: ResourceSample[],
  probe: ProbeSample[]
): PhaseResult => {
  const processMb = processPeak(probe);
  const seconds = load.elapsedMs / 1000;
  const cpuUsec = after.cpuUsec - before.cpuUsec;
  const periods = (after.periods ?? 0) - (before.periods ?? 0);
  const throttled = (after.throttledPeriods ?? 0) - (before.throttledPeriods ?? 0);
  const memory = samples.map(reading => reading.memoryBytes);
  const anon = samples.flatMap(reading => (reading.anonBytes === undefined ? [] : [reading.anonBytes]));

  return {
    scenario: scenario.name,
    concurrency,
    requests: load.requests,
    rps: round(load.requests / seconds),
    errors: load.errors,
    unexpected: load.unexpected,
    bytesPerResponse: load.requests === 0 ? 0 : Math.round(load.bytes / load.requests),
    latencyMs: summarizeLatencies(load.latenciesMs),
    cpuMsPerRequest: load.requests === 0 ? 0 : round(cpuUsec / 1000 / load.requests, 2),
    cpuCores: round(cpuUsec / 1_000_000 / seconds, 2),
    ...(periods > 0 ? { throttledShare: round(throttled / periods, 2) } : {}),
    memoryMb: {
      mean: memory.length === 0 ? 0 : mb(memory.reduce((sum, value) => sum + value, 0) / memory.length),
      max: memory.length === 0 ? 0 : mb(Math.max(...memory)),
      ...(anon.length === 0 ? {} : { anonMax: mb(Math.max(...anon)) })
    },
    ...(processMb ? { processMb } : {})
  };
};

/** Throws, saying how it died, when the server is no longer running. */
const ensureAlive = async (server: RunningTarget, where: string): Promise<void> => {
  const state = await server.state();
  if (state.running) {
    return;
  }

  const death = state.oomKilled ? 'killed for running out of memory' : `exited with code ${state.exitCode ?? '?'}`;
  throw new Error(`${where}: ${death}`);
};

/**
 * One target under one profile: start it cold, let it idle, then hold every scenario at every concurrency for a
 * while, reading its CPU and memory throughout. A server that dies stops the run there and says why.
 */
export const measureTarget = async (
  runtime: Runtime,
  target: Target,
  profile: Profile,
  options: MeasureOptions,
  progress: (line: string) => void
): Promise<TargetResult> => {
  const result: TargetResult = { target: target.name, status: 'ok', phases: [], oomKilled: false };
  try {
    await target.prepare?.(options.workspaceRoot);
  } catch (error) {
    return {
      ...result,
      status: 'failed',
      failure: `could not be prepared: ${error instanceof Error ? error.message : String(error)}`
    };
  }

  const launchedAt = performance.now();
  const server = await runtime.launch({
    target,
    profile,
    workspaceRoot: options.workspaceRoot,
    nodeOptions: options.nodeOptions,
    env: options.env
  });

  try {
    await waitUntilReady(server.baseUrl, target.ready, BOOT_TIMEOUT_MS, async () => (await server.state()).running);
    result.bootMs = Math.round(performance.now() - launchedAt);
    const idleFrom = Date.now();
    await sleep(SETTLE_MS);
    const idle = await server.sample();
    result.idleMb = mb(idle.memoryBytes);
    if (idle.anonBytes !== undefined) {
      result.idleAnonMb = mb(idle.anonBytes);
    }

    const idleProcess = processPeak(await server.probe(idleFrom));
    if (idleProcess) {
      result.idleProcessMb = idleProcess;
    }

    progress(`booted in ${result.bootMs}ms, ${result.idleMb} MB idle`);

    for (const scenario of target.scenarios) {
      for (const concurrency of options.concurrency) {
        const agent = createLoadAgent(concurrency);
        const load = { baseUrl: server.baseUrl, scenario, concurrency, agent };
        const where = `${scenario.name} at ${concurrency} connections`;
        if (options.warmupMs > 0) {
          await runLoad({ ...load, durationMs: options.warmupMs });
          await ensureAlive(server, `${where}, warming up`);
        }

        const before = await server.sample();
        const phaseFrom = Date.now();
        const sampler = server.sampleEvery(SAMPLE_INTERVAL_MS);
        const measured = await runLoad({ ...load, durationMs: options.durationMs });
        agent.destroy();
        const samples = sampler.stop();
        await ensureAlive(server, where);

        const probe = await server.probe(phaseFrom);
        const phase = phaseResult(scenario, concurrency, measured, before, await server.sample(), samples, probe);
        result.phases.push(phase);
        progress(
          `${scenario.name} c=${concurrency}: ${phase.rps} req/s, p99 ${round(phase.latencyMs.p99)}ms, ` +
            `${phase.cpuMsPerRequest} CPU ms/req, ${phase.memoryMb.max} MB max`
        );
      }
    }

    await sleep(SETTLE_MS);
    const settled = await server.sample();
    result.retainedMb = mb(settled.memoryBytes);
    if (settled.peakBytes !== undefined) {
      result.peakMb = mb(settled.peakBytes);
    }
  } catch (error) {
    result.status = 'failed';
    result.failure = error instanceof Error ? error.message : String(error);
    result.logsTail = await server.logs().catch(() => '');
  } finally {
    result.oomKilled = (await server.state().catch(() => undefined))?.oomKilled ?? false;
    await server.stop();
  }

  return result;
};

const median = (values: number[]): number | undefined => {
  if (values.length === 0) {
    return undefined;
  }

  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
};

const defined = (values: (number | undefined)[]): number[] => values.filter(value => value !== undefined);

/**
 * Several cold runs of one target, as one: each phase is the run of it with the median requests a second, and each
 * whole-run figure the median of the runs.
 *
 * Runs are separate processes on purpose. On a machine whose cores are not alike — Apple silicon's performance and
 * efficiency cores — a container can land on either and a whole process runs at one speed or the other, up to twice
 * apart. Repeating inside one process only measures that one landing again.
 */
export const combineRuns = (runs: TargetResult[]): TargetResult => {
  const failed = runs.find(run => run.status === 'failed');
  if (failed || runs.length === 1) {
    return failed ?? runs[0];
  }

  const [first] = runs;
  const phases = first.phases.map((phase, index) => {
    const candidates = runs.map(run => run.phases[index]).sort((a, b) => a.rps - b.rps);

    return candidates[Math.floor(candidates.length / 2)] ?? phase;
  });
  const bootMs = median(defined(runs.map(run => run.bootMs)));
  const idleMb = median(defined(runs.map(run => run.idleMb)));
  const retainedMb = median(defined(runs.map(run => run.retainedMb)));
  const peakMb = median(defined(runs.map(run => run.peakMb)));

  return {
    ...first,
    phases,
    ...(bootMs === undefined ? {} : { bootMs }),
    ...(idleMb === undefined ? {} : { idleMb }),
    ...(retainedMb === undefined ? {} : { retainedMb }),
    ...(peakMb === undefined ? {} : { peakMb })
  };
};
