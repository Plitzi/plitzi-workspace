import { createHash } from 'node:crypto';

import type { CpuMeter } from '../cpuMeter';
import type { IsolateRunner } from '../isolate';
import type { FunctionLimits } from '@plitzi/sdk-shared/functions';

/**
 * A bundle as the runner receives one — an ES module whose default export declares one task, `probe.run` — written by
 * hand: what the runner is tested against is the runner, with no engine and no build in between.
 */
export const bundleOf = (body: string, topLevel = ''): { id: string; code: string } => {
  const code = `${topLevel}
export default { tasks: [{ namespace: 'probe', action: 'run', title: 'Probe', params: {}, run: async (params, ctx) => { ${body} } }] };`;

  return { id: createHash('sha256').update(code).digest('hex'), code };
};

export const LIMITS: FunctionLimits = { cpuMs: 200, wallMs: 3000, memoryMb: 32, outputBytes: 65_536, calls: 20 };

/** The answer of a platform that refuses every call: what a guest reaches through `ctx` is never this test's subject. */
const refuseEveryCall = (): Promise<unknown> => Promise.reject(new Error('No platform answers calls in this test'));

/** What an invocation is handed besides its bundle and limits: the platform's answers, and where its waits are told. */
export type InvokeOptions = {
  answer?: (call: unknown) => Promise<unknown>;
  onWaited?: (ms: number) => void;
};

export type Outcome = { value: unknown } | { reason: string; message: string };

/** One invocation of `probe.run`, its outcome said: what it returned, or the reason and message it was stopped with. */
export const invoke = async (
  runner: IsolateRunner,
  bundle: { id: string; code: string },
  limits: Partial<FunctionLimits> = {},
  { answer = refuseEveryCall, onWaited }: InvokeOptions = {}
): Promise<Outcome> => {
  try {
    const value = await runner.invoke({
      bundle: { id: bundle.id, load: () => Promise.resolve(bundle.code) },
      invocation: {
        kind: 'task',
        name: 'probe.run',
        params: {},
        context: { spaceId: 1, environment: 'production', runId: 'attack', trigger: 'call', callerId: 'ip:127.0.0.1' }
      },
      limits: { ...LIMITS, ...limits },
      answer,
      signal: new AbortController().signal,
      ...(onWaited ? { onWaited } : {})
    });

    return { value };
  } catch (error) {
    const reason = typeof error === 'object' && error !== null && 'reason' in error ? String(error.reason) : 'thrown';

    return { reason, message: error instanceof Error ? error.message : String(error) };
  }
};

/** The reason an invocation was stopped with, or `undefined` when it returned. */
export const reasonOf = (outcome: Outcome): string | undefined => ('reason' in outcome ? outcome.reason : undefined);

/** What an invocation was stopped with, or `undefined` when it returned. */
export const messageOf = (outcome: Outcome): string | undefined => ('message' in outcome ? outcome.message : undefined);

/** What an invocation returned, or `undefined` when it was stopped. */
export const valueOf = (outcome: Outcome): unknown => ('value' in outcome ? outcome.value : undefined);

/** A meter that charges a share of what V8 measured: what a crowded core would, or more. */
export const meterCharging = (share: number): CpuMeter => ({
  meter: read => {
    const from = read();

    return { charged: () => (read() - from) * share, end: () => undefined };
  }
});

/** Code that computes for `ms` of the clock, then answers `done`. */
export const spinFor = (ms: number): string =>
  `const until = Date.now() + ${String(ms)}; while (Date.now() < until) {} return 'done';`;
