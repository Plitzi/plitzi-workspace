import { createHash, createHmac, randomBytes } from 'node:crypto';

import { installGuest } from './guest';
import { guestPrelude } from './prelude';
import { FunctionFailure } from '../protocol';

import type { GuestDriver } from './guest';
import type {
  FunctionsBundleRef,
  FunctionInvocation,
  FunctionUsage,
  FunctionLimits,
  FunctionRunner,
  FunctionsBundle,
  FunctionStopReason
} from '../protocol';
import type IsolatedVM from 'isolated-vm';

type Ivm = typeof IsolatedVM;

export type IsolateRunnerOptions = {
  /**
   * Invocations running at once; the rest wait their turn. Each isolate may take about twice its `memoryMb`, so this
   * times that times two is what the runner needs.
   */
  concurrency?: number;
  /**
   * How many bytes of bundles this runner keeps — their code and V8's cache of it — least recently used let go first.
   * A bundle it no longer has is asked of the platform again; one it has is never sent twice.
   */
  cacheBytes?: number;
};

/** The isolates, and what readies them before the first invocation pays for it. */
export type IsolateRunner = FunctionRunner & {
  /**
   * Builds the prelude, the heap every isolate starts from and V8's cache of the guest, and runs a first bundle — what
   * the first invocation of a fresh process would otherwise spend (~70 ms) on top of its own.
   */
  warm: () => Promise<void>;
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

/** What isolated-vm throws when a `timeout` it was given runs out. */
const ISOLATE_TIMEOUT = 'Script execution timed out.';

/** How long code that listens to `ctx.signal` gets to stop by itself before the isolate is disposed under it. */
const ABORT_GRACE_MS = 50;

const loadIvm = async (): Promise<Ivm> => {
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

const stopMessage = (reason: FunctionStopReason, limits: FunctionLimits): string => {
  switch (reason) {
    case 'cpu':
      return `Stopped after ${String(limits.cpuMs)} ms of CPU`;
    case 'wall':
      return `Did not finish within ${String(limits.wallMs)} ms`;
    case 'memory':
      return `Went over its ${String(limits.memoryMb)} MB of memory`;
    case 'output':
      return `Answered more than the ${String(limits.outputBytes)} bytes it may`;
    case 'calls':
      return `Made more than the ${String(limits.calls)} calls to the platform it may`;
    case 'aborted':
      return 'The run was aborted';
  }
};

/** The one `crypto.subtle` a guest cannot do by itself, done with the runner's own: digests and HMAC. */
const cryptoAnswer = (message: string): string => {
  try {
    const request: unknown = JSON.parse(message);
    if (typeof request !== 'object' || request === null || !('op' in request) || !('hash' in request)) {
      throw new Error('Not a crypto operation');
    }

    const hash = String(request.hash).replace('-', '').toLowerCase();
    const data = Buffer.from('data' in request ? String(request.data) : '', 'base64');
    const key = Buffer.from('key' in request ? String(request.key) : '', 'base64');
    const digest =
      request.op === 'hmac' ? createHmac(hash, key).update(data).digest() : createHash(hash).update(data).digest();

    return JSON.stringify({ ok: true, value: digest.toString('base64') });
  } catch (error) {
    return JSON.stringify({ ok: false, error: messageOf(error) });
  }
};

/**
 * Sets the guest up in a fresh context: the runner's four calls, taken off the global the moment they are captured,
 * and the guest printed from its own source. Answers the driver.
 */
const BOOTSTRAP = `(() => {
  const refs = { call: __plitziCall, sleep: __plitziSleep, random: __plitziRandom, crypto: __plitziCrypto };
  delete globalThis.__plitziCall;
  delete globalThis.__plitziSleep;
  delete globalThis.__plitziRandom;
  delete globalThis.__plitziCrypto;
  const transfer = { arguments: { copy: true }, result: { promise: true, copy: true } };
  return (${installGuest.toString()})(globalThis, {
    call: message => refs.call.apply(undefined, [message], transfer),
    sleep: ms => refs.sleep.apply(undefined, [ms], transfer),
    random: length => refs.random(length),
    crypto: message => refs.crypto.apply(undefined, [message], transfer)
  });
})()`;

type Cached = { code: string; bytes: number; cachedData?: IsolatedVM.ExternalCopy<ArrayBuffer> };

type Session = {
  bundle: FunctionsBundleRef;
  limits: FunctionLimits;
  answer: (call: unknown) => Promise<unknown>;
  signal?: AbortSignal;
  onUsage?: (usage: FunctionUsage) => void;
  /** Given the guest's driver and the definition, answers the guest's JSON. */
  drive: (driver: IsolatedVM.Reference<GuestDriver>, definition: IsolatedVM.Reference<unknown>) => Promise<string>;
};

/**
 * The runner as V8 isolates in this process — what the runner service serves, and what a deployment may use directly
 * when the process holds nothing a space's code must not reach (tests, a sandbox of its own).
 *
 * ONE ISOLATE PER INVOCATION: each limit is then exactly that invocation's — its CPU, its memory — and stopping it
 * disposes nothing anybody else was using. No state survives an invocation, by construction. The cost is ~2 ms: the
 * prelude comes from a V8 snapshot, the guest and the bundle from V8's code cache after their first compile.
 */
export const createIsolateRunner = ({
  concurrency = 8,
  cacheBytes = 64 * 1024 * 1024
}: IsolateRunnerOptions = {}): IsolateRunner => {
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

  const session = async ({ bundle, limits, answer, signal, onUsage, drive }: Session): Promise<unknown> => {
    const ivm = await ready();
    // Before a slot is taken: fetching code a runner does not keep is waiting on the platform, not running anything.
    const entry = await cached(bundle);
    await acquire();

    const isolate = new ivm.Isolate({ memoryLimit: limits.memoryMb, snapshot });
    const timers = new Set<NodeJS.Timeout>();
    let stopped: FunctionStopReason | undefined;
    let calls = 0;
    const startedAt = Date.now();
    /** The CPU the isolate used, kept as it is read: a disposed isolate has none left to ask. */
    let cpuMs = 0;
    const readCpu = (): number => {
      if (!isolate.isDisposed) {
        cpuMs = Number(isolate.cpuTime) / 1e6;
      }

      return cpuMs;
    };
    const stop = (reason: FunctionStopReason): void => {
      stopped ??= reason;
      readCpu();
      if (!isolate.isDisposed) {
        isolate.dispose();
      }
    };
    const later = (ms: number, run: () => void): void => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        run();
      }, ms);
      timers.add(timer);
    };
    const watchdog = setInterval(() => {
      if (!isolate.isDisposed && readCpu() > limits.cpuMs) {
        stop('cpu');
      }
    }, WATCHDOG_MS);
    later(limits.wallMs, () => stop('wall'));

    let driver: IsolatedVM.Reference<GuestDriver> | undefined;
    const onAbort = (): void => {
      driver
        ?.get('abort', { reference: true })
        .then(abort => abort.apply(undefined, ['The run was aborted']))
        .catch(() => undefined);
      later(ABORT_GRACE_MS, () => stop('aborted'));
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

          try {
            // Read by the platform, not here: a runner is not trusted to have checked what the code sent.
            const value = await answer(JSON.parse(message));

            return JSON.stringify({ ok: true, value: value ?? null });
          } catch (error) {
            return JSON.stringify({ ok: false, error: messageOf(error) });
          }
        })
      );
      global.setSync(
        '__plitziSleep',
        new ivm.Reference(
          (ms: number): Promise<void> =>
            new Promise(resolve => later(Math.min(Math.max(0, ms), limits.wallMs), resolve))
        )
      );
      global.setSync(
        '__plitziRandom',
        new ivm.Callback((length: number) => [...randomBytes(Math.min(Math.max(0, length), 65536))])
      );
      global.setSync('__plitziCrypto', new ivm.Reference((message: string) => Promise.resolve(cryptoAnswer(message))));

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
      await module.evaluate({ timeout: limits.cpuMs });
      const definition = module.namespace.getSync('default', { reference: true });
      if (definition.typeof !== 'object') {
        throw new FunctionFailure(
          'error',
          'functions/index.ts exports its definition by default: export default defineFunctions({ … })'
        );
      }

      const text = await drive(driver, definition);
      if (Buffer.byteLength(text) > limits.outputBytes) {
        stop('output');
      }

      if (stopped) {
        throw new FunctionFailure(stopped, stopMessage(stopped, limits));
      }

      const outcome: unknown = JSON.parse(text);
      if (typeof outcome !== 'object' || outcome === null || !('ok' in outcome)) {
        throw new FunctionFailure('error', 'The runtime answered something that is not an outcome');
      }

      if (outcome.ok !== true) {
        throw new FunctionFailure('error', 'error' in outcome ? String(outcome.error) : 'The function failed');
      }

      return 'value' in outcome ? outcome.value : null;
    } catch (error) {
      if (error instanceof FunctionFailure && !stopped) {
        throw error;
      }

      // isolated-vm's own timeout is only ever given `cpuMs`, so its error is the CPU limit too — reached inside a
      // synchronous stretch before the watchdog looked. Disposed with no reason of ours: V8 ran out of the isolate's
      // memory and took it down itself.
      const timedOut = error instanceof Error && error.message === ISOLATE_TIMEOUT;
      const reason = stopped ?? (timedOut ? 'cpu' : isolate.isDisposed ? 'memory' : undefined);
      throw reason
        ? new FunctionFailure(reason, stopMessage(reason, limits))
        : new FunctionFailure('error', messageOf(error));
    } finally {
      onUsage?.({ cpuMs: Math.round(readCpu()), wallMs: Date.now() - startedAt, calls });
      clearInterval(watchdog);
      timers.forEach(timer => clearTimeout(timer));
      signal?.removeEventListener('abort', onAbort);
      if (!isolate.isDisposed) {
        isolate.dispose();
      }

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
          timeout: DESCRIBE_LIMITS.cpuMs
        });
      }
    });

  return {
    describe,
    invoke: ({ bundle, invocation, limits, answer, signal, onUsage }) =>
      session({
        bundle,
        limits,
        answer,
        signal,
        onUsage,
        drive: async (driver, definition) => {
          const invoke = driver.getSync('invoke', { reference: true });
          const message = JSON.stringify(invocation satisfies FunctionInvocation);

          return invoke.apply(driver.derefInto(), [definition.derefInto(), message], {
            result: { promise: true, copy: true },
            timeout: limits.cpuMs
          });
        }
      }),
    warm: async () => {
      await ready();
      // One whole invocation's path, so V8's cache of the guest is made now too — not by a visitor's first request.
      await describe({ id: 'plitzi:warm-up', code: 'export default {};' });
    }
  };
};
