import { createHash, randomUUID } from 'node:crypto';

import { isTerminalJobStatus } from '@plitzi/sdk-shared/actions';
import { isRecord } from '@plitzi/sdk-shared/helpers';

import { answerCall, readCall } from './capabilities';
import { functionLimitsFor } from './config';
import { functionContextFor } from './context';
import { FunctionFailure } from './protocol';
import { serverLog } from '../../helpers/serverLog';
import { ActionRefusal, isActionRefusal } from '../actions/runtime/errors';

import type { FunctionsConfig } from './config';
import type {
  FunctionContext,
  FunctionJobHandle,
  FunctionJobs,
  FunctionJobStop,
  FunctionsDefinition
} from './contract';
import type { FunctionCall, FunctionLimits, FunctionUsage, SpaceFunctions } from './protocol';
import type { TaskContextSource } from '../actions/runtime/runAction';
import type {
  FunctionJobTarget,
  Job,
  JobQueue,
  Environment,
  FunctionJobManifest,
  FunctionJobView,
  RunUser,
  SpaceRevision
} from '@plitzi/sdk-shared';

/**
 * A space's jobs (`defineFunctions({ jobs })`): work longer than a request, kept in the actions' durable queue and run
 * slice by slice — in the sandbox, in a space's runtime, or natively in a self-hosted server.
 *
 * A slice ends when the code returns (the job is done), throws (an attempt failed: the next starts from the last save),
 * or is asked to stop: paused, cancelled, its time in one go up, the replica going away. `job.save` is the one
 * checkpoint, and the rule that keeps a job from looping forever is that a slice cut by its time goes on only if it saved
 * since it began.
 */

/** What a server lets a space's jobs spend: a deployment sets it per space (its plan), each unset one the default's. */
export type FunctionJobLimits = {
  /** Jobs running at once, across `pool`. */
  running: number;
  /** The spaces whose jobs `running` counts together — an account's. Default: the space alone. */
  pool?: number[];
  /** Jobs waiting (`pending` or `paused`) in one space. */
  waiting: number;
  /** How long one job may run, every slice together, in seconds. */
  maxSeconds: number;
  /** How long one slice runs in the sandbox before it is asked to save and go on in the next. */
  sliceMs: number;
  /** CPU one slice in the sandbox may use. */
  sliceCpuMs: number;
  /** Calls to `ctx` one slice in the sandbox may make. */
  sliceCalls: number;
  /** The most a job keeps of what it saves — and of its input — as JSON, in bytes. */
  stateBytes: number;
};

export const DEFAULT_FUNCTION_JOB_LIMITS: Omit<FunctionJobLimits, 'pool'> = {
  running: 10,
  waiting: 1_000,
  maxSeconds: 6 * 60 * 60,
  sliceMs: 5 * 60_000,
  sliceCpuMs: 30_000,
  sliceCalls: 10_000,
  stateBytes: 1_000_000
};

/** How long a slice asked to end has to save and return before it is cut. */
export const JOB_GRACE_MS = 5_000;

/** The least time between two reports a watcher hears: what a loop reporting every iteration costs nothing more than. */
const REPORT_EVERY_MS = 250;

/** How long a job over its account's running jobs waits before it is looked at again. */
const BUSY_WAIT_MS = 5_000;

/** The most running jobs read to decide which of them go on: past it, every one but the oldest waits. */
const RUNNING_READ = 1_000;

/** A name a keyed job is known by, as a topic is written. */
const KEY = /^[A-Za-z0-9:_.-]{1,128}$/;

const STOPS: readonly FunctionJobStop[] = ['pause', 'cancel', 'limit', 'shutdown'];

const isStop = (value: unknown): value is FunctionJobStop => STOPS.some(stop => stop === value);

// `JSON.stringify` answers no text for `undefined`, whatever its declaration says: it is kept as nothing, four bytes.
const bytesOf = (value: unknown): number => (value === undefined ? 4 : Buffer.byteLength(JSON.stringify(value)));

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** How a slice ended, for the worker to settle the job by. */
export type JobSliceOutcome =
  | { kind: 'done'; result: unknown; spentMs: number }
  | { kind: 'stopped'; stop: FunctionJobStop; saved: boolean; spentMs: number }
  /** `final`: no attempt would change it — a refusal, a job no code declares, a job out of its time. */
  | { kind: 'failed'; error: string; final: boolean; refused: boolean; spentMs: number }
  /** Not started: the account runs as many jobs as it may, or may not run code right now. */
  | { kind: 'wait'; delayMs: number; why: string };

/** Who and where a run of a space's code is, as `ctx.jobs` starts a job from it. */
export type JobRunScope = { spaceId: number; environment: Environment; at?: SpaceRevision; user?: RunUser };

export type FunctionJobsService = {
  /** `ctx.jobs` for one run of a space's code, over the jobs that code declares. */
  forRun: (run: JobRunScope, declared: Readonly<Record<string, FunctionJobManifest>>) => FunctionJobs;
  /** Runs one slice of `job`, `signal` aborting with why (`pause`, `cancel`, `shutdown`) when its worker is told to. */
  slice: (job: Job, signal: AbortSignal, workerId: string) => Promise<JobSliceOutcome>;
  /** Says how the job is now to whoever watches it (`$job:<id>`). Never fails: a watcher missing a beat is not a fault. */
  announce: (spaceId: number, jobId: string) => Promise<void>;
};

export type FunctionJobsDeps = {
  /** Read when asked: the queue is made after the runner, and a server may run none. */
  queue: () => JobQueue | undefined;
  config: FunctionsConfig;
  getFunctions?: (spaceId: number, at?: SpaceRevision) => Promise<SpaceFunctions | undefined>;
  /** Read when a slice runs: the runner that makes it is made after this. */
  taskContext: () => TaskContextSource;
  /** Says the job as it is on `$job:<id>` — absent when the server has no realtime channels. */
  publish?: (space: { spaceId: number; environment: string }, jobId: string, view: FunctionJobView) => Promise<void>;
  maxAttempts: number;
};

/** What a job's declaration says besides its code, as a manifest holds it. */
export const jobsManifestOf = (definition: FunctionsDefinition): Record<string, FunctionJobManifest> =>
  Object.fromEntries(
    Object.entries(definition.jobs ?? {}).map(([name, job]) => [
      name,
      {
        ...(job.watch ? { watch: job.watch } : {}),
        ...(job.maxSeconds === undefined ? {} : { maxSeconds: job.maxSeconds })
      }
    ])
  );

/**
 * A job as whoever may watch it sees it: never its input or what it saved, and of a failure only the code's own refusal
 * — anything else it threw can carry what a visitor must not read, and stays in the Queue for an operator.
 */
export const jobViewOf = (job: Job): FunctionJobView => {
  const last = job.history.at(-1);
  const failed = job.status === 'failed' || job.status === 'dead';

  return {
    id: job.id,
    name: job.target.name,
    status: job.status,
    ...(job.progress ? { progress: job.progress.fraction } : {}),
    ...(job.progress?.step ? { step: job.progress.step } : {}),
    ...(job.status === 'succeeded' && job.result !== undefined ? { result: job.result } : {}),
    ...(failed ? { error: last?.refused && last.error ? last.error : 'The job failed' } : {}),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };
};

export const createFunctionJobs = ({
  queue,
  config,
  getFunctions,
  taskContext,
  publish,
  maxAttempts
}: FunctionJobsDeps): FunctionJobsService => {
  const queueOrThrow = (): JobQueue => {
    const found = queue();
    if (!found) {
      throw new Error(
        'This server runs no jobs — its actions have no queue (`jobs: false`, or no way to list actions)'
      );
    }

    return found;
  };

  const limitsOf = async (spaceId: number): Promise<FunctionJobLimits> => ({
    ...DEFAULT_FUNCTION_JOB_LIMITS,
    ...(await config.jobs?.limitsFor?.(spaceId))
  });

  const announce = async (spaceId: number, jobId: string): Promise<void> => {
    if (!publish) {
      return;
    }

    try {
      const job = await queue()?.getJob([spaceId], jobId);
      if (job?.target.kind === 'function') {
        await publish({ spaceId, environment: job.environment }, jobId, jobViewOf(job));
      }
    } catch (error) {
      serverLog.warn('Functions', `job ${jobId} of space ${String(spaceId)}: its watchers were not told`, error);
    }
  };

  /** A job of this space's functions by id — a run of an action under the same id is not one `ctx.jobs` reaches. */
  const ownJob = async (spaceId: number, id: string): Promise<Job | undefined> => {
    const job = typeof id === 'string' && id !== '' ? await queueOrThrow().getJob([spaceId], id) : undefined;

    return job?.target.kind === 'function' ? job : undefined;
  };

  const forRun = (run: JobRunScope, declared: Readonly<Record<string, FunctionJobManifest>>): FunctionJobs => {
    const { spaceId } = run;
    /** A stop or a resume, said to the job's watchers when it changed something. */
    const changed = async (id: string, change: (jobs: JobQueue) => Promise<boolean>): Promise<boolean> => {
      const jobs = queueOrThrow();
      if (!(await ownJob(spaceId, id)) || !(await change(jobs))) {
        return false;
      }

      await announce(spaceId, id);

      return true;
    };

    return {
      start: async (name, input = {}, { key } = {}) => {
        const jobs = queueOrThrow();
        const declaration = Object.hasOwn(declared, name) ? declared[name] : undefined;
        if (!declaration) {
          const names = Object.keys(declared);
          throw new Error(
            `No job "${name}": ${names.length ? `this code declares ${names.join(', ')}` : 'declare it in jobs of defineFunctions'}`
          );
        }

        if (!isRecord(input)) {
          throw new Error('A job is handed an object as its input');
        }

        if (key !== undefined && (typeof key !== 'string' || !KEY.test(key))) {
          throw new Error('A key is 1 to 128 letters, digits and `:_.-` — `train:model-7`');
        }

        const limits = await limitsOf(spaceId);
        if (bytesOf(input) > limits.stateBytes) {
          throw new Error(
            `A job's input is ${String(bytesOf(input))} bytes, over the ${String(limits.stateBytes)} a job keeps: hand it an id to read the rest by`
          );
        }

        const counted = await Promise.all(
          (['pending', 'paused'] as const).map(
            async status =>
              (await jobs.listJobs({ spaceIds: [spaceId], kind: 'function', status, limit: 1, offset: 0 })).total
          )
        );
        const waiting = counted.reduce((sum, count) => sum + count, 0);
        if (waiting >= limits.waiting) {
          throw new ActionRefusal(
            `This space has ${String(waiting)} jobs waiting, the most it may: let some of them finish first`
          );
        }

        // A key names the job: at most one of it at a time, started over once it ended.
        const id =
          key === undefined
            ? `job:${String(spaceId)}:${randomUUID()}`
            : `job:${String(spaceId)}:${name}:${createHash('sha256').update(key).digest('hex').slice(0, 24)}`;
        const created = await jobs.enqueue({
          id,
          spaceId,
          environment: run.environment,
          target: {
            kind: 'function',
            name,
            ...(run.user ? { user: run.user } : {}),
            ...(declaration.watch ? { watch: declaration.watch } : {}),
            ...(run.at ? { at: run.at } : {})
          },
          input,
          dueAt: (await jobs.now()).getTime(),
          maxAttempts,
          ...(key === undefined ? {} : { key })
        });
        if (!created) {
          const existing = await jobs.getJob([spaceId], id);
          // Under way: the one already running is the answer. Ended: it starts over, with what it was handed now — and
          // of two that raced to start it again, the second finds the first's under way.
          if (existing && isTerminalJobStatus(existing.status)) {
            await jobs.requeue([spaceId], id, { input, fresh: true });
          }
        }

        await announce(spaceId, id);
        const job = await jobs.getJob([spaceId], id);
        if (!job) {
          throw new Error(`Job "${name}" was started and is not in the queue: the queue lost it`);
        }

        return jobViewOf(job);
      },

      get: async id => {
        const job = await ownJob(spaceId, id);

        return job ? jobViewOf(job) : undefined;
      },

      pause: id => changed(id, jobs => jobs.pause([spaceId], id)),
      resume: id => changed(id, jobs => jobs.resume([spaceId], id)),
      cancel: id => changed(id, jobs => jobs.cancel([spaceId], id))
    };
  };

  /** Where a job's code is: the deployment's own (natively), or the space's (through its runner). */
  type Found =
    | { native: true; definition: FunctionsDefinition }
    | { native: false; functions: SpaceFunctions; declaration: FunctionJobManifest };

  const find = async (spaceId: number, target: FunctionJobTarget): Promise<Found | undefined> => {
    const definition = (config.native ?? []).find(each => Object.hasOwn(each.jobs ?? {}, target.name));
    if (definition) {
      return { native: true, definition };
    }

    const functions = await getFunctions?.(spaceId, target.at);
    const declaration = functions?.manifest.jobs?.[target.name];

    return functions && declaration ? { native: false, functions, declaration } : undefined;
  };

  const slice = async (job: Job, signal: AbortSignal, workerId: string): Promise<JobSliceOutcome> => {
    const jobs = queueOrThrow();
    const startedAt = Date.now();
    const spent = () => Date.now() - startedAt;
    const { target } = job;
    if (target.kind !== 'function') {
      return {
        kind: 'failed',
        error: 'A run of an action is not a job of functions',
        final: true,
        refused: false,
        spentMs: 0
      };
    }

    const found = await find(job.spaceId, target);
    if (!found) {
      return {
        kind: 'failed',
        error: `This space's functions declare no job "${target.name}" any more`,
        final: true,
        refused: false,
        spentMs: 0
      };
    }

    const limits = await limitsOf(job.spaceId);
    const { jobs: running } = await jobs.listJobs({
      spaceIds: limits.pool ?? [job.spaceId],
      kind: 'function',
      status: 'running',
      limit: RUNNING_READ,
      offset: 0
    });
    // This one is among them: claimed, it is running. The oldest go on and the rest wait — the same order on every
    // replica, so two claimed at once are never both sent back, nor both let through.
    const order = running
      .sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))
      .findIndex(each => each.id === job.id);
    if (order === -1 || order >= limits.running) {
      return {
        kind: 'wait',
        delayMs: BUSY_WAIT_MS + Math.floor(Math.random() * BUSY_WAIT_MS),
        why: `waiting: ${String(Math.min(running.length - 1, limits.running))} jobs of this account run at once, the most it may`
      };
    }

    const refusal = found.native ? undefined : await config.admit?.(job.spaceId);
    if (refusal) {
      return { kind: 'wait', delayMs: BUSY_WAIT_MS, why: `waiting: ${refusal}` };
    }

    const declared = found.native ? jobsManifestOf(found.definition)[target.name] : found.declaration;
    const maxMs = Math.min(limits.maxSeconds, declared.maxSeconds ?? limits.maxSeconds) * 1000;
    const remainingMs = maxMs - (job.activeMs ?? 0);
    if (remainingMs <= 0) {
      return {
        kind: 'failed',
        error: `ran for ${String(Math.round(maxMs / 1000))} s, the most a job may`,
        final: true,
        refused: false,
        spentMs: 0
      };
    }

    // A slice in the sandbox has a time in one go; one in a process of the space's own — a runtime, or the deployment's
    // code — runs until the job's time is up, held by its lease.
    const sandboxed = !found.native && !found.functions.runner;
    const boundMs = sandboxed ? Math.min(limits.sliceMs, remainingMs) : remainingMs;
    const lastSlice = boundMs >= remainingMs;

    const stopper = new AbortController();
    const forward = (): void => stopper.abort(isStop(signal.reason) ? signal.reason : 'cancel');
    signal.addEventListener('abort', forward, { once: true });
    if (signal.aborted) {
      forward();
    }

    const timer = setTimeout(() => stopper.abort('limit' satisfies FunctionJobStop), boundMs);
    let saved = false;
    let reported: { fraction: number; step?: string } | undefined;
    let reportTimer: NodeJS.Timeout | undefined;
    let reportedAt = 0;

    /** A write the worker no longer holds the job for: the job is somebody else's now, and this slice stops. */
    const held = (written: boolean): void => {
      if (!written) {
        stopper.abort('shutdown' satisfies FunctionJobStop);
      }
    };

    const flushReport = async (): Promise<void> => {
      clearTimeout(reportTimer);
      reportTimer = undefined;
      const progress = reported;
      reported = undefined;
      if (!progress) {
        return;
      }

      reportedAt = Date.now();
      held(await jobs.write({ jobId: job.id, workerId, progress }));
      await announce(job.spaceId, job.id);
    };

    const save = async (state: unknown): Promise<void> => {
      const bytes = bytesOf(state);
      if (bytes > limits.stateBytes) {
        throw new Error(
          `job.save: the state is ${String(bytes)} bytes, over the ${String(limits.stateBytes)} a job keeps — save where it is, not what it made`
        );
      }

      const written = await jobs.write({ jobId: job.id, workerId, state });
      held(written);
      if (!written) {
        throw new Error('job.save: this server no longer holds the job — another one took it over');
      }

      saved = true;
    };

    const report = (fraction: number, step?: string): void => {
      reported = {
        fraction: Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0)),
        ...(step ? { step: step.slice(0, 200) } : {})
      };
      if (reportTimer) {
        return;
      }

      reportTimer = setTimeout(
        () => {
          flushReport().catch((error: unknown) => {
            serverLog.warn('Functions', `job ${job.id}: a report was not kept`, error);
          });
        },
        Math.max(0, REPORT_EVERY_MS - (Date.now() - reportedAt))
      );
    };

    const user = target.user;
    const ctx = taskContext()(
      {
        runId: randomUUID(),
        spaceId: job.spaceId,
        environment: job.environment,
        trigger: 'call',
        callerId: user ? `user:${String(user.id)}` : 'job',
        ...(user ? { user } : {}),
        ...(target.at ? { at: target.at } : {})
      },
      stopper.signal,
      [`job:${target.name}`]
    );
    const log = (line: string): void => {
      serverLog.info('Functions', `job ${target.name} ${job.id} of space ${String(job.spaceId)}: ${line}`);
    };
    const contextOf = (hosts: readonly string[], definition: Pick<FunctionsDefinition, 'oauth'>, manifest = {}) => ({
      ...functionContextFor({ ...ctx, log }, hosts, undefined, definition.oauth, manifest),
      trigger: 'job'
    });

    /** How the code ended, read with why it was asked to: returning once asked to stop is stopping, not finishing. */
    const outcomeOf = (ended: { value: unknown } | { error: unknown }): JobSliceOutcome => {
      const stop = stopper.signal.aborted && isStop(stopper.signal.reason) ? stopper.signal.reason : undefined;
      if (stop === 'limit' && lastSlice) {
        return {
          kind: 'failed',
          error: `ran for ${String(Math.round(maxMs / 1000))} s, the most a job may`,
          final: true,
          refused: false,
          spentMs: spent()
        };
      }

      if (stop && 'value' in ended) {
        return { kind: 'stopped', stop, saved, spentMs: spent() };
      }

      if ('value' in ended) {
        return { kind: 'done', result: ended.value, spentMs: spent() };
      }

      const { error } = ended;
      const refused = isActionRefusal(error) || (error instanceof FunctionFailure && error.reason === 'refused');
      if (refused) {
        return { kind: 'failed', error: messageOf(error), final: true, refused: true, spentMs: spent() };
      }

      // Asked to stop and cut once its grace was up, or out of its time in one go: what it saved is where it goes on.
      if (stop) {
        return { kind: 'stopped', stop, saved, spentMs: spent() };
      }

      return { kind: 'failed', error: messageOf(error), final: false, refused: false, spentMs: spent() };
    };

    const slicePart = { id: job.id, attempt: job.attempts, ...(job.state === undefined ? {} : { state: job.state }) };
    try {
      if (found.native) {
        const { definition } = found;
        const declaredJob = definition.jobs?.[target.name];
        if (!declaredJob) {
          throw new Error(`This server's functions declare no job "${target.name}"`);
        }

        const fnCtx: FunctionContext = contextOf(definition.allow?.hosts ?? [], definition, jobsManifestOf(definition));
        const handle: FunctionJobHandle<unknown> = {
          id: job.id,
          name: target.name,
          state: job.state,
          attempt: job.attempts,
          save,
          report,
          get stopping() {
            const reason: unknown = stopper.signal.reason;

            return stopper.signal.aborted && isStop(reason) ? reason : undefined;
          },
          signal: stopper.signal
        };
        const value: unknown = await declaredJob.run(job.input, handle, fnCtx);

        return outcomeOf({ value: value === undefined ? null : value });
      }

      const { functions } = found;
      const runner = functions.runner ?? config.runner;
      if (!runner) {
        throw new Error('This server runs no space functions');
      }

      const fnCtx = contextOf(functions.manifest.hosts, functions.manifest, functions.manifest.jobs);
      const base = functionLimitsFor(config.limits, functions.limits, functions.manifest.limits);
      const limitsForSlice: FunctionLimits = {
        ...base,
        cpuMs: sandboxed ? limits.sliceCpuMs : boundMs,
        wallMs: boundMs + JOB_GRACE_MS,
        calls: sandboxed ? limits.sliceCalls : Number.MAX_SAFE_INTEGER
      };
      const answer = async (raw: unknown): Promise<unknown> => {
        const call: FunctionCall = readCall(raw);
        if (call.op !== 'job') {
          return answerCall(fnCtx, call);
        }

        if (call.method === 'save') {
          await save(call.state);

          return null;
        }

        report(call.fraction, call.step);

        return null;
      };
      let usage: FunctionUsage | undefined;
      let ok = false;
      try {
        const value = await runner.invoke({
          bundle: functions.bundle,
          invocation: {
            kind: 'job',
            name: target.name,
            input: job.input,
            job: slicePart,
            context: {
              spaceId: fnCtx.spaceId,
              environment: fnCtx.environment,
              runId: fnCtx.runId,
              trigger: fnCtx.trigger,
              callerId: fnCtx.callerId,
              ...(fnCtx.user ? { user: fnCtx.user } : {})
            },
            graceMs: JOB_GRACE_MS
          },
          limits: limitsForSlice,
          answer,
          signal: stopper.signal,
          onUsage: spentNow => {
            usage = spentNow;
          }
        });
        ok = true;

        return outcomeOf({ value });
      } finally {
        if (usage) {
          config.onUsage?.({ spaceId: job.spaceId, task: `job ${target.name}`, ok, usage });
        }
      }
    } catch (error) {
      return outcomeOf({ error });
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', forward);
      await flushReport().catch((error: unknown) => {
        serverLog.warn('Functions', `job ${job.id}: its last report was not kept`, error);
      });
    }
  };

  return { forRun, slice, announce };
};
