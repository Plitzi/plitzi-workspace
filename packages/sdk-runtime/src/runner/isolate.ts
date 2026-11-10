import { createHash, createHmac, pbkdf2, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

import { cpuLimitCores } from '@plitzi/sdk-kernel/stats';
import { changeKv, changeListEntry } from '@plitzi/sdk-shared/functions';
import { FunctionFailure, failedAnswerOf } from '@plitzi/sdk-shared/functions';

import { createCpuMeter } from './cpuMeter';
import { createFunctionsDriver, describeFunctions } from './driver';
import { guestBytes } from './guest/bytes';
import { guestCrypto } from './guest/crypto';
import { guestEvents } from './guest/events';
import { guestFetch } from './guest/fetch';
import { installGuest } from './guest/install';
import { guestPrelude } from './prelude';
import { createRunClock } from './runClock';
import { createStops, failureOfStop, failureOfThrown, stopMessage } from './stops';
import { createTurnHolder } from './turnHolder';
import { createTurns } from './turns';

import type { CpuMeter, MeteredIsolate } from './cpuMeter';
import type { GuestDriver } from './guest/types';
import type {
  FunctionsBundleRef,
  FunctionInvocation,
  FunctionUsage,
  FunctionLimits,
  FunctionRunner,
  FunctionsBundle
} from '@plitzi/sdk-shared/functions';
import type IsolatedVM from 'isolated-vm';

type Ivm = typeof IsolatedVM;

export type IsolateRunnerOptions = {
  /**
   * Invocations running at once, at most: the runner service turns the rest away (`busy`) for the platform to place on
   * another runner — and takes fewer while its memory is short (`memoryShare`). Each isolate may grow to about twice its
   * `memoryMb`; most wait on the network and hold a few MB, which is why memory, not this, decides how many run.
   */
  concurrency?: number;
  /**
   * How many bytes of bundles this runner keeps — their code and V8's cache of it — least recently used let go first.
   * A bundle it no longer has is asked of the platform again; one it has is never sent twice. 32 MB by default: a bundle
   * let go costs one recompile, which V8's code cache shortens.
   */
  cacheBytes?: number;
  /**
   * How many isolates run JavaScript at once: as many as the cores this runner may use (its container's quota, at least
   * one) by default. An isolate waiting on the platform — a call, a sleep, a derivation — gives its turn up and takes one
   * again when the answer is back. isolated-vm runs isolates on as many threads as the machine has cores, whatever the
   * container's quota: past it they fought for its CPU. With turns, fewer fight at once; what each is charged is the
   * meter's (`cpuMeter`).
   */
  turns?: number;
  /**
   * What each isolate is charged of the CPU: its share of the process's own, as the system counts it, by default
   * (`createCpuMeter`) — never the time it waited for a core, which V8 counts as its CPU. A test hands one of its own.
   */
  cpuMeter?: CpuMeter;
};

/** The isolates, and what readies them before the first invocation pays for it. */
export type IsolateRunner = FunctionRunner & {
  /**
   * Builds the prelude, the heap every isolate starts from and V8's cache of the guest, and runs a first bundle — what
   * the first invocation of a fresh process would otherwise spend (~70 ms) on top of its own.
   */
  warm: () => Promise<void>;
  /**
   * Gives back the invocation whose isolate holds the most memory — what the runner does when it runs short of its own
   * (`startFunctionsRunnerService`): stopped as `memory` when it is past its own limit (the code's), else handed back
   * as `busy`, for another runner (the runner's). What it gave back, or nothing when nothing runs.
   */
  shed: () => { overItsOwn: boolean; heldMb: number; spaceId: number } | undefined;
};

/** An invocation running, as the runner short of memory reads it: what its isolate holds, and how to give it back. */
type LiveInvocation = {
  heldBytes: () => number;
  limitBytes: number;
  spaceId: number;
  shed: (overItsOwn: boolean) => void;
};

/** What reading a bundle's declaration may spend: its top level runs, and nothing else. */
const DESCRIBE_LIMITS: FunctionLimits = { cpuMs: 1000, wallMs: 5000, memoryMb: 64, outputBytes: 1_000_000, calls: 100 };

/**
 * What a bundle's top level can call while it is read: only the console, since `ctx` exists only in an invocation — and
 * a line logged while loading is nobody's to read.
 */
const describeAnswer = (call: unknown): Promise<unknown> =>
  typeof call === 'object' && call !== null && 'op' in call && call.op === 'log'
    ? Promise.resolve(undefined)
    : Promise.reject(new Error('Nothing is reachable while a bundle is read'));

const WATCHDOG_MS = 5;
/** How long code that listens to `ctx.signal` gets to stop by itself before the isolate is disposed under it. */
const ABORT_GRACE_MS = 50;

const NO_NODE_SNAPSHOT = '--no-node-snapshot';

/**
 * Since Node 20 the process starts from Node's own V8 snapshot, and isolated-vm's isolates crash beside it — not always,
 * which is why this refuses up front rather than letting a process run until the one invocation that brings it down.
 */
const nodeSnapshotOff = (): boolean =>
  Number(process.versions.node.split('.')[0]) < 20 ||
  process.execArgv.includes(NO_NODE_SNAPSHOT) ||
  (process.env.NODE_OPTIONS ?? '').split(/\s+/).includes(NO_NODE_SNAPSHOT);

const loadIvm = async (): Promise<Ivm> => {
  if (!nodeSnapshotOff()) {
    throw new Error(
      `Running space functions in isolates needs Node started with ${NO_NODE_SNAPSHOT} ` +
        `(e.g. NODE_OPTIONS=${NO_NODE_SNAPSHOT}): isolated-vm crashes beside Node's startup snapshot`
    );
  }

  try {
    return (await import('isolated-vm')).default;
  } catch {
    throw new Error('Running space functions in isolates needs isolated-vm installed beside @plitzi/sdk-server');
  }
};

/**
 * The code cache a compile produced. isolated-vm sets it on the compiled script or module, and its declarations leave
 * it out — so it is looked for rather than assumed.
 */
const cachedDataOf = (ivm: Ivm, compiled: object): IsolatedVM.ExternalCopy<ArrayBuffer> | undefined =>
  'cachedData' in compiled && compiled.cachedData instanceof ivm.ExternalCopy ? compiled.cachedData : undefined;

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * The most a PBKDF2 derivation may ask for. The runner does the work, outside the isolate's clock, so each is bounded
 * here and its time is charged to the run's CPU: a million rounds is past any password guidance, and 1024 bits past
 * any key.
 */
export const PBKDF2_MAX_ITERATIONS = 1_000_000;
export const PBKDF2_MAX_BITS = 1024;

const derive = promisify(pbkdf2);

const cryptoField = (request: Record<string, unknown>, name: string): string => {
  const value = request[name];
  if (typeof value !== 'string') {
    throw new Error(`The operation has no ${name}`);
  }

  return value;
};

const boundedInteger = (text: string, what: string, max: number): number => {
  const value = Number(text);
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new Error(`${what} is a whole number from 1 to ${String(max)}`);
  }

  return value;
};

/**
 * The `crypto.subtle` a guest cannot do by itself, done with the runner's own: digests, HMAC and PBKDF2. A derivation
 * is the one that costs, and `charge` is handed what it took.
 */
const cryptoAnswer = async (message: string, charge: (ms: number) => void): Promise<string> => {
  try {
    const request: unknown = JSON.parse(message);
    if (typeof request !== 'object' || request === null || Array.isArray(request)) {
      throw new Error('Not a crypto operation');
    }

    const fields: Record<string, unknown> = { ...request };
    const hash = cryptoField(fields, 'hash').replace('-', '').toLowerCase();
    const bytes = (name: string): Buffer => Buffer.from(cryptoField(fields, name), 'base64');
    const op = cryptoField(fields, 'op');
    if (op === 'pbkdf2') {
      const iterations = boundedInteger(cryptoField(fields, 'iterations'), 'PBKDF2 iterations', PBKDF2_MAX_ITERATIONS);
      const bits = boundedInteger(cryptoField(fields, 'bits'), 'A PBKDF2 length in bits', PBKDF2_MAX_BITS);
      if (bits % 8 !== 0) {
        throw new Error('A PBKDF2 length is a multiple of 8 bits');
      }

      const started = performance.now();
      const derived = await derive(bytes('key'), bytes('salt'), iterations, bits / 8, hash);
      charge(performance.now() - started);

      return JSON.stringify({ ok: true, value: derived.toString('base64') });
    }

    if (op !== 'hmac' && op !== 'digest') {
      throw new Error(`${op} is not a crypto operation`);
    }

    const digest =
      op === 'hmac'
        ? createHmac(hash, bytes('key')).update(bytes('data')).digest()
        : createHash(hash).update(bytes('data')).digest();

    return JSON.stringify({ ok: true, value: digest.toString('base64') });
  } catch (error) {
    return JSON.stringify({ ok: false, error: messageOf(error) });
  }
};

/**
 * Sets the guest up in a fresh context: the runner's four calls, taken off the global the moment they are captured,
 * and the guest printed from its own source, its web APIs first, a part at a time — with the platform's functions it runs
 * as they are (`GuestShared`),
 * printed from theirs. Answers the driver.
 */
const BOOTSTRAP = `(() => {
  const refs = { call: __plitziCall, sleep: __plitziSleep, random: __plitziRandom, crypto: __plitziCrypto };
  delete globalThis.__plitziCall;
  delete globalThis.__plitziSleep;
  delete globalThis.__plitziRandom;
  delete globalThis.__plitziCrypto;
  const transfer = { arguments: { copy: true }, result: { promise: true, copy: true } };
  const host = {
    call: message => refs.call.apply(undefined, [message], transfer),
    sleep: ms => refs.sleep.apply(undefined, [ms], transfer),
    random: length => refs.random(length),
    crypto: message => refs.crypto.apply(undefined, [message], transfer)
  };
  const bytes = (${guestBytes.toString()})();
  const events = (${guestEvents.toString()})(host);
  const parts = {
    bytes,
    events,
    fetch: (${guestFetch.toString()})(bytes, events),
    crypto: (${guestCrypto.toString()})(host, bytes)
  };
  return (${installGuest.toString()})(globalThis, host, { changeKv: ${changeKv.toString()}, changeListEntry: ${changeListEntry.toString()}, describeFunctions: ${describeFunctions.toString()}, createFunctionsDriver: ${createFunctionsDriver.toString()} }, parts);
})()`;

type Cached = { code: string; bytes: number; cachedData?: IsolatedVM.ExternalCopy<ArrayBuffer> };

type Session = {
  bundle: FunctionsBundleRef;
  limits: FunctionLimits;
  answer: (call: unknown) => Promise<unknown>;
  signal?: AbortSignal;
  /** How long code that listens to `ctx.signal` gets once it is aborted — a job's slice says, anything else is quick. */
  graceMs?: number;
  onUsage?: (usage: FunctionUsage) => void;
  /** How long it waited for a turn at the runner's CPU, as it waits — the runner's time, not the code's (1.3's `waited`). */
  onWaited?: (ms: number) => void;
  /** Given the guest's driver and the definition, answers the guest's JSON. */
  drive: (driver: IsolatedVM.Reference<GuestDriver>, definition: IsolatedVM.Reference<unknown>) => Promise<string>;
  /** Whose code it is, for what a runner short of memory says it gave back (`shed`). */
  spaceId?: number;
};

/**
 * The runner as V8 isolates in this process — what the runner service serves, and what a deployment may use directly
 * when the process holds nothing a space's code must not reach (tests, a sandbox of its own).
 *
 * ONE ISOLATE PER INVOCATION: each limit is then exactly that invocation's — its CPU, its memory — and stopping it
 * disposes nothing anybody else was using. No state survives an invocation, by construction. The cost is ~2 ms: the
 * prelude comes from a V8 snapshot, the guest and the bundle from V8's code cache after their first compile.
 */
/** How many isolates run at once when the runner is not told. */
export const DEFAULT_CONCURRENCY = 8;

export const createIsolateRunner = ({
  concurrency = DEFAULT_CONCURRENCY,
  cacheBytes = 32 * 1024 * 1024,
  turns: turnCount = Math.max(1, Math.round(cpuLimitCores())),
  cpuMeter: cpu = createCpuMeter(WATCHDOG_MS, cpuLimitCores())
}: IsolateRunnerOptions = {}): IsolateRunner => {
  const turns = createTurns(turnCount);
  /** Every invocation running, with the memory its isolate holds and the way to give it back (`shed`). */
  const live = new Set<LiveInvocation>();
  const cache = new Map<string, Cached>();
  let cachedBytes = 0;
  /** Every isolate starts from a heap with the prelude already run in it: running it each time was most of the cost. */
  let snapshot: IsolatedVM.ExternalCopy<ArrayBuffer> | undefined;
  let guestCache: IsolatedVM.ExternalCopy<ArrayBuffer> | undefined;
  let running = 0;
  const waiting: (() => void)[] = [];

  const acquire = async (): Promise<void> => {
    if (running >= concurrency) {
      await new Promise<void>(resolve => waiting.push(resolve));
    }

    running++;
  };

  const release = (): void => {
    running--;
    waiting.shift()?.();
  };

  /** The bundle's entry, most recently used now: its code fetched only when this runner has never kept it. */
  const cached = async (bundle: FunctionsBundleRef): Promise<Cached> => {
    const kept = cache.get(bundle.id);
    if (kept) {
      cache.delete(bundle.id);
      cache.set(bundle.id, kept);

      return kept;
    }

    const code = await bundle.load();
    const entry: Cached = { code, bytes: Buffer.byteLength(code) };
    cache.set(bundle.id, entry);
    cachedBytes += entry.bytes;
    for (const [id, oldest] of cache) {
      if (cachedBytes <= cacheBytes || id === bundle.id) {
        break;
      }

      cache.delete(id);
      cachedBytes -= oldest.bytes;
    }

    return entry;
  };

  /** What every isolate is made from, once per process: the module, the prelude, the heap it starts as. */
  const ready = async (): Promise<Ivm> => {
    const ivm = await loadIvm();
    snapshot ??= ivm.Isolate.createSnapshot([{ code: await guestPrelude(), filename: 'plitzi:prelude' }]);

    return ivm;
  };

  const session = async ({
    bundle,
    limits,
    answer,
    signal,
    graceMs = ABORT_GRACE_MS,
    onUsage,
    onWaited,
    drive,
    spaceId = 0
  }: Session): Promise<unknown> => {
    const ivm = await ready();
    // Before a slot is taken: fetching code a runner does not keep is waiting on the platform, not running anything.
    const entry = await cached(bundle);
    await acquire();

    const isolate = new ivm.Isolate({ memoryLimit: limits.memoryMb, snapshot });
    const timers = new Set<NodeJS.Timeout>();
    const clock = createRunClock();
    const turn = createTurnHolder(turns);
    let calls = 0;
    /** The CPU the isolate was measured at, kept as it is read: a disposed isolate has none left to ask. */
    let isolateCpuMs = 0;
    /**
     * The isolate's CPU once it was ready — the guest and the bundle compiled, the first time on a runner without V8's
     * cache of them: the platform's work, not the space's code. Its time is the code's own from there.
     */
    let readyCpuMs: number | undefined;
    const readIsolateCpu = (): number => {
      if (!isolate.isDisposed) {
        isolateCpuMs = Number(isolate.cpuTime) / 1e6;
      }

      return isolateCpuMs;
    };
    /** Whether it ran since the last look: what it was measured at moved. */
    const readCpu = (): number => (readyCpuMs === undefined ? 0 : readIsolateCpu() - readyCpuMs) + clock.hostCpuMs();
    let metered: MeteredIsolate | undefined;
    /** What its CPU read when the watchdog last looked: still, while it waits, it is not running. */
    let lastCpuMs = 0;
    const { stop, stopped } = createStops(() => {
      readCpu();
      if (!isolate.isDisposed) {
        isolate.dispose();
      }
    });
    /** Something it asked of the platform, its turn given up while it waits and taken again before it hears back. */
    const waitingOn = async <T>(work: () => Promise<T>): Promise<T> => {
      clock.waitBegins();
      turn.give();
      try {
        return await work();
      } finally {
        clock.waitEnds();
        await turn.take();
      }
    };
    const running: LiveInvocation = {
      heldBytes: (): number => {
        if (isolate.isDisposed) {
          return 0;
        }

        const heap = isolate.getHeapStatisticsSync();

        return heap.used_heap_size + heap.externally_allocated_size;
      },
      limitBytes: limits.memoryMb * 1048576,
      spaceId,
      shed: (overItsOwn: boolean) => {
        stop(overItsOwn ? 'memory' : 'shed');
      }
    };
    live.add(running);
    const later = (ms: number, run: () => void): void => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        run();
      }, ms);
      timers.add(timer);
    };
    const watchdog = setInterval(() => {
      const cpuMs = readCpu();
      // Its CPU is its share of what the process took (`createCpuMeter`): beside more isolates than cores, never the time
      // it waited for one.
      const over = isolate.isDisposed ? undefined : clock.overLimit(limits);
      if (over) {
        stop(over);
      }

      const untold = onWaited ? clock.untoldWaitedMs() : undefined;
      if (onWaited && untold !== undefined) {
        onWaited(untold);
      }

      // Back from one answer while it waits on others, it holds its turn though it runs nothing: given up once its CPU
      // stood still a whole look — the next answer back takes one again.
      if (turn.holds() && clock.waits() > 0 && cpuMs === lastCpuMs) {
        turn.give();
      }

      lastCpuMs = cpuMs;
    }, WATCHDOG_MS);

    let driver: IsolatedVM.Reference<GuestDriver> | undefined;
    const onAbort = (): void => {
      // Why it was asked to end, when it was said — a job's slice tells its code whether it was paused or timed.
      const reason = typeof signal?.reason === 'string' ? signal.reason : 'The run was aborted';
      driver
        ?.get('abort', { reference: true })
        .then(abort => abort.apply(undefined, [reason]))
        .catch(() => undefined);
      later(graceMs, () => stop('aborted'));
    };

    try {
      // Everything up to the space's own code is ours and quick, so it is done synchronously: each await across the
      // isolate's thread costs more than the step it waits for.
      const context = isolate.createContextSync();
      const global = context.global;
      global.setSync('globalThis', global.derefInto());
      global.setSync(
        '__plitziCall',
        new ivm.Reference(async (message: string): Promise<string> => {
          calls++;
          if (calls > limits.calls) {
            stop('calls');

            return JSON.stringify({ ok: false, error: stopMessage('calls', limits) });
          }

          return waitingOn(async () => {
            try {
              // Read by the platform, not here: a runner is not trusted to have checked what the code sent.
              const value = await answer(JSON.parse(message));

              return JSON.stringify({ ok: true, value: value ?? null });
            } catch (error) {
              return JSON.stringify(failedAnswerOf(error));
            }
          });
        })
      );
      global.setSync(
        '__plitziSleep',
        new ivm.Reference((ms: number): Promise<void> => {
          const plan = clock.sleep(ms, limits.wallMs);
          if (!plan.wakes) {
            later(plan.stopInMs, () => stop('wall'));

            return waitingOn(() => new Promise<void>(() => undefined));
          }

          return waitingOn(
            () =>
              new Promise<void>(resolve => {
                later(plan.wanted, () => {
                  plan.woke();
                  resolve();
                });
              })
          );
        })
      );
      global.setSync(
        '__plitziRandom',
        new ivm.Callback((length: number) => [...randomBytes(Math.min(Math.max(0, length), 65536))])
      );
      global.setSync(
        '__plitziCrypto',
        new ivm.Reference((message: string) =>
          waitingOn(() =>
            cryptoAnswer(message, ms => {
              clock.chargeHost(ms);
              if (clock.chargedCpu() > limits.cpuMs) {
                stop('cpu');
              }
            })
          )
        )
      );

      const guestScript = isolate.compileScriptSync(BOOTSTRAP, {
        filename: 'plitzi:guest',
        ...(guestCache ? { cachedData: guestCache } : { produceCachedData: true })
      });
      guestCache ??= cachedDataOf(ivm, guestScript);
      driver = guestScript.runSync(context, { reference: true });
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) {
        onAbort();
      }

      const module = isolate.compileModuleSync(entry.code, {
        filename: 'functions.js',
        ...(entry.cachedData ? { cachedData: entry.cachedData } : { produceCachedData: true })
      });
      entry.cachedData ??= cachedDataOf(ivm, module);
      module.instantiateSync(context, specifier => {
        throw new Error(`"${specifier}" cannot be imported: a bundle is one module`);
      });
      // Ready: what runs from here — the bundle's own top level, then the call — is the code's CPU, run in its turn.
      await turn.take();
      readyCpuMs = readIsolateCpu();
      const meter = cpu.meter(readIsolateCpu);
      metered = meter;
      clock.begin(() => meter.charged());
      // No timeout of isolated-vm's: it counts the clock while JavaScript runs, a core waited for included, and stopped
      // code for the runner's load. The watchdog judges its time and CPU, and disposing the isolate stops any loop.
      await module.evaluate();
      const definition = module.namespace.getSync('default', { reference: true });
      if (definition.typeof !== 'object') {
        throw new FunctionFailure(
          'error',
          'The functions bundle exports no definition: each file at the top of functions/ exports one by default — export default defineFunctions({ tasks: [ … ] })'
        );
      }

      const text = await drive(driver, definition);
      if (Buffer.byteLength(text) > limits.outputBytes) {
        stop('output');
      }

      const stoppedFor = stopped();
      if (stoppedFor) {
        throw failureOfStop(stoppedFor, limits);
      }

      const outcome: unknown = JSON.parse(text);
      if (typeof outcome !== 'object' || outcome === null || !('ok' in outcome)) {
        throw new FunctionFailure('error', 'The runtime answered something that is not an outcome');
      }

      if (outcome.ok !== true) {
        throw new FunctionFailure(
          'refused' in outcome && outcome.refused === true ? 'refused' : 'error',
          'error' in outcome ? String(outcome.error) : 'The function failed'
        );
      }

      return 'value' in outcome ? outcome.value : null;
    } catch (error) {
      throw failureOfThrown(error, { stopped: stopped(), disposed: isolate.isDisposed, limits });
    } finally {
      live.delete(running);
      metered?.end();
      onUsage?.({ cpuMs: Math.round(clock.chargedCpu()), wallMs: clock.elapsedMs(), calls });
      clearInterval(watchdog);
      timers.forEach(timer => clearTimeout(timer));
      signal?.removeEventListener('abort', onAbort);
      if (!isolate.isDisposed) {
        isolate.dispose();
      }

      turn.end();
      release();
    }
  };

  const describe = (bundle: FunctionsBundle): Promise<unknown> =>
    session({
      bundle: { id: bundle.id, load: () => Promise.resolve(bundle.code) },
      limits: DESCRIBE_LIMITS,
      answer: describeAnswer,
      drive: async (driver, definition) => {
        const describeRef = driver.getSync('describe', { reference: true });

        return describeRef.apply(driver.derefInto(), [definition.derefInto()], {
          result: { copy: true },
          timeout: DESCRIBE_LIMITS.wallMs
        });
      }
    });

  return {
    describe,
    invoke: ({ bundle, invocation, limits, answer, signal, onUsage, onWaited }) =>
      session({
        bundle,
        limits,
        answer,
        signal,
        spaceId: invocation.context.spaceId,
        ...(invocation.kind === 'job' ? { graceMs: invocation.graceMs } : {}),
        onUsage,
        ...(onWaited ? { onWaited } : {}),
        drive: async (driver, definition) => {
          const invoke = driver.getSync('invoke', { reference: true });
          const message = JSON.stringify(invocation satisfies FunctionInvocation);

          return invoke.apply(driver.derefInto(), [definition.derefInto(), message], {
            result: { promise: true, copy: true }
          });
        }
      }),
    shed: () => {
      const largest = [...live]
        .map(each => ({ each, held: each.heldBytes() }))
        .reduce<{ each: LiveInvocation; held: number } | undefined>(
          (most, next) => (most === undefined || next.held > most.held ? next : most),
          undefined
        );
      if (!largest) {
        return undefined;
      }

      const overItsOwn = largest.held > largest.each.limitBytes;
      largest.each.shed(overItsOwn);

      return { overItsOwn, heldMb: Math.round(largest.held / 1048576), spaceId: largest.each.spaceId };
    },
    warm: async () => {
      await ready();
      // One whole invocation's path, so V8's cache of the guest is made now too — not by a visitor's first request.
      await describe({ id: 'plitzi:warm-up', code: 'export default {};' });
    }
  };
};
