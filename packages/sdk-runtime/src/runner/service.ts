import http from 'node:http';

import { WebSocketServer } from 'ws';

import { SHUTDOWN_GRACE_MS, bearerMatches, frameText, shutdownOf, watchConnections } from '@plitzi/sdk-kernel/http';
import { logQueryOf, readLogTail, serverLog } from '@plitzi/sdk-kernel/log';
import {
  STATS_LOGS_PATH,
  STATS_PATH,
  createStatsRecorder,
  overloaded,
  processLoad,
  sampleProcessMemory,
  withStopping
} from '@plitzi/sdk-kernel/stats';
import {
  FUNCTIONS_PROTOCOL,
  FunctionFailure,
  errorOfAnswer,
  isStreamedRouteAnswer,
  protocolKnows,
  protocolRefusal,
  readRequestMessage
} from '@plitzi/sdk-shared/functions';

import { DEFAULT_CONCURRENCY, createIsolateRunner } from './isolate';

import type { IsolateRunnerOptions } from './isolate';
import type {
  MemoryReading,
  ProcessLoad,
  RunEnd,
  RunLabel,
  StatsConfig,
  StatsRecorder
} from '@plitzi/sdk-kernel/stats';
import type {
  FunctionAnswer,
  FunctionFailureReason,
  FunctionLimits,
  FunctionRunner,
  FunctionUsage,
  RunnerResponseMessage,
  StreamedRouteAnswer
} from '@plitzi/sdk-shared/functions';
import type { AddressInfo } from 'node:net';
import type { WebSocket } from 'ws';

export type FunctionsRunnerServiceOptions = IsolateRunnerOptions & {
  /** What the platform presents as `Authorization: Bearer <secret>`. Required: a runner anybody reaches runs anybody's code. */
  secret: string;
  port?: number;
  host?: string;
  /**
   * The engine; the isolates in this process by default, warmed before the service listens. It keeps the bundles it
   * runs — this service keeps none of its own — and asks the platform for one it does not have.
   */
  runner?: FunctionRunner;
  /**
   * What answers plain HTTP besides `/health` — a space runtime's endpoints — behind the same secret as the protocol.
   * Answers whether it took the request; one it did not take is a 404.
   */
  http?: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<boolean>;
  /**
   * How this runner names itself in its stats (`GET /_stats`, behind the same secret as the protocol): its pool —
   * `runner` by default — its instance, and where `degraded` starts. It always keeps them.
   */
  stats?: Pick<StatsConfig, 'pool' | 'instance' | 'thresholds'>;
  /**
   * The version its stats say it runs — the deployment's, as its page servers' and workers' say theirs: what tells a
   * rolling deploy, or one stopped half-way, from a pool that is all on one version.
   */
  version?: string;
  /**
   * The share of its memory limit it takes new invocations up to, from 0 to 1: 0.85 by default. An invocation is taken
   * while what the runner holds, and a share of what the invocation may grow to (`limits.memoryMb`), fit under it —
   * past it the platform is answered `busy` and places it on another runner, instead of the process being killed for
   * memory with every invocation in it. Its memory, not a count, is what says how many it runs: one waiting on the
   * network holds a few MB. `concurrency` is the most it runs at once all the same.
   */
  memoryShare?: number;
  /**
   * Whether it says it listens (`[Functions] runner listening on …`): what a runner of its own does. A host that runs the
   * service inside something else — a space's runtime — says what it is itself, once, and passes `false`.
   */
  announce?: boolean;
  /**
   * How it stops (`close()`): for `announceMs` its `/health` answers 503 and it takes no new invocation — the platform
   * is answered `busy`, and takes it to another runner — while it keeps running what it has; then what is still
   * running has `graceMs` to end before it is cut. 0 and 10000 by default; `graceMs` at least the longest function's
   * time limit, or a deploy cuts one halfway.
   */
  shutdown?: { announceMs?: number; graceMs?: number };
  /** How full the process is; its resident memory against its container's limit by default. For tests. */
  readMemory?: () => MemoryReading;
  /**
   * How loaded its CPU is (`processLoad` by default): past `LOAD_LIMITS` it takes no new invocation — the platform places
   * it on another runner — so a runner whose invocations are spending its CPU does not slow every one of them down.
   */
  readLoad?: () => ProcessLoad;
};

export type FunctionsRunnerService = {
  /** Where it listens, once it does. */
  address: () => AddressInfo;
  close: () => Promise<void>;
};

/** A bundle is at most 1 MB and an answer a few; anything past this on one frame is not the platform talking. */
const MAX_FRAME_BYTES = 8 * 1024 * 1024;

/**
 * The share of what an invocation may grow to (`limits.memoryMb`) kept free for it as it is taken: most wait on the
 * network and hold a few MB, and its isolate's own limit stops one that grows past its own.
 */
const MEMORY_RESERVE_SHARE = 0.25;

/**
 * How long an invocation taken is still reserved its share beside what the runner holds: until its isolate is built and
 * held — what a reading of the memory then says. A burst taken within one reading is each reserved its share, not all
 * admitted on the room one had.
 */
const RESERVED_FOR_MS = 1_000;

/** The runner's stops that are limits — the code asked for more than it may: not a fault of the runner's. */
const LIMITS: ReadonlySet<FunctionFailureReason> = new Set(['cpu', 'wall', 'memory', 'output', 'calls']);

/** How an invocation that did not answer reads to the stats: a limit, its code refusing, or a failure. */
const endOf = (reason: FunctionFailureReason): RunEnd =>
  LIMITS.has(reason) ? { limit: reason } : reason === 'refused' ? { refused: true } : { failed: reason };

/**
 * One operation on one connection — `describe`, or `invoke` with every call the code makes going back on the same
 * socket. The platform replica that asked is the one answering, so nothing about a run has to be shared between
 * replicas, and a connection that closes is the invocation aborting.
 */
/** What one connection tells the runner's stats: an invocation in flight, how it ended, a version refused. */
type ConnectionStats = {
  recorder: StatsRecorder;
  inFlight: { count: number };
  /** Why this runner takes no new invocation of these limits right now, or nothing — and then it is counted as taken. */
  busy: (limits: FunctionLimits) => string | undefined;
  /** Whether that is because it is stopping, rather than short of memory: what its stats count it as. */
  stopping: () => boolean;
};

const serveConnection = (socket: WebSocket, runner: FunctionRunner, stats: ConnectionStats): void => {
  const pending = new Map<number, (answer: FunctionAnswer) => void>();
  const controller = new AbortController();
  let nextCall = 1;
  let started = false;
  let waitingBundle: ((code: string) => void) | undefined;

  const send = (message: RunnerResponseMessage): void => {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  };
  let invokedAt: number | undefined;
  /** What it runs, for its stats: which space's task, route or job. */
  let label: RunLabel | undefined;
  const finish = (message: RunnerResponseMessage): void => {
    if (invokedAt !== undefined) {
      stats.inFlight.count -= 1;
      stats.recorder.run(Date.now() - invokedAt, message.type === 'failed' ? endOf(message.reason) : undefined, label);
      invokedAt = undefined;
    }

    send(message);
    socket.close(1000);
  };
  let usage: FunctionUsage | undefined;
  /** A route answering as it writes: its head now, each part of its body as it comes, and `done` once it ends. */
  const stream = async (answer: StreamedRouteAnswer): Promise<void> => {
    send({ type: 'head', status: answer.status, statusText: answer.statusText, headers: answer.headers });
    const reader = answer.body.getReader();
    // The platform gone or the run aborted: the code's stream is cancelled, which its own `cancel` hears.
    const stop = (): void => {
      reader.cancel().catch(() => undefined);
    };
    controller.signal.addEventListener('abort', stop, { once: true });
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        send({ type: 'chunk', chunk: { base64: Buffer.from(value).toString('base64') } });
      }
    } finally {
      controller.signal.removeEventListener('abort', stop);
    }
  };
  const settle = (work: Promise<unknown>): void => {
    work.then(
      async value => {
        if (!isStreamedRouteAnswer(value)) {
          finish({ type: 'done', value, ...(usage ? { usage } : {}) });

          return;
        }

        try {
          await stream(value);
          finish({ type: 'done', value: null, ...(usage ? { usage } : {}) });
        } catch (error) {
          finish({
            type: 'failed',
            reason: 'error',
            error: `The route's answer broke off: ${error instanceof Error ? error.message : String(error)}`,
            ...(usage ? { usage } : {})
          });
        }
      },
      (error: unknown) =>
        finish({
          type: 'failed',
          ...(error instanceof FunctionFailure
            ? { reason: error.reason, error: error.message }
            : { reason: 'error' as const, error: error instanceof Error ? error.message : String(error) }),
          ...(usage ? { usage } : {})
        })
    );
  };
  const answer = (call: unknown): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const id = nextCall++;
      pending.set(id, reply => (reply.ok ? resolve(reply.value) : reject(errorOfAnswer(reply))));
      send({ type: 'call', id, call });
    });

  socket.on('message', data => {
    const message = readRequestMessage(frameText(data));
    if (!message) {
      finish({ type: 'failed', reason: 'error', error: 'Not a message of the functions protocol' });

      return;
    }

    if (message.type === 'answer') {
      const reply = pending.get(message.id);
      pending.delete(message.id);
      reply?.(message.answer);

      return;
    }

    if (message.type === 'abort') {
      controller.abort(message.reason);

      return;
    }

    if (message.type === 'bundle') {
      waitingBundle?.(message.bundle.code);
      waitingBundle = undefined;

      return;
    }

    if (started) {
      finish({ type: 'failed', reason: 'error', error: 'One operation per connection' });

      return;
    }

    started = true;
    const refusal = protocolRefusal(message.protocol);
    if (refusal) {
      stats.recorder.refuse('protocol');
      finish({ type: 'failed', reason: 'error', error: refusal });

      return;
    }

    if (message.type === 'describe') {
      settle(runner.describe(message.bundle));

      return;
    }

    const { bundleId, invocation, limits } = message;
    // Taken only with an isolate free and memory for it: a runner full answers at once, and the platform places the
    // invocation on another rather than leaving it to wait here, its time running.
    const busy = stats.busy(limits);
    if (busy) {
      stats.recorder.refuse(stats.stopping() ? 'stopping' : 'busy');
      finish({ type: 'failed', reason: 'busy', error: busy });

      return;
    }

    label = {
      spaceId: invocation.context.spaceId,
      kind: invocation.kind,
      // A route is named by its method and path (`GET /orders/:id`), the others by theirs.
      name: invocation.kind === 'route' ? invocation.key : invocation.name,
      trigger: invocation.context.trigger,
      runId: invocation.context.runId
    };
    invokedAt = Date.now();
    stats.inFlight.count += 1;
    // What the platform waits for its answer from (1.2): an older one is told nothing it does not know.
    if (protocolKnows(message.protocol, '1.2')) {
      send({ type: 'accepted' });
    }

    settle(
      runner.invoke({
        // The code only if the engine has never kept this id: asked of the platform on this same connection.
        bundle: {
          id: bundleId,
          load: () =>
            new Promise<string>(resolve => {
              waitingBundle = resolve;
              send({ type: 'needBundle' });
            })
        },
        invocation,
        limits,
        answer,
        signal: controller.signal,
        onUsage: spent => {
          usage = spent;
        }
      })
    );
  });

  socket.on('close', () => {
    controller.abort();
    pending.forEach(reply => reply({ ok: false, error: 'The platform went away' }));
    pending.clear();
  });
};

/**
 * The functions runner as a service: a process that holds no secrets, no database and no documents, and runs the
 * spaces' code in isolates for the platform that authenticates to it. What a sandbox escape reaches is this process.
 *
 * `GET /health` answers 200 for the orchestrator; `GET /_stats` its stats and everything else the WebSocket protocol,
 * behind the secret.
 */
export const startFunctionsRunnerService = async ({
  secret,
  port = 8790,
  host = '0.0.0.0',
  runner,
  http: answerHttp,
  stats: naming,
  version,
  memoryShare = 0.85,
  announce = true,
  shutdown,
  readMemory = sampleProcessMemory(),
  readLoad = processLoad,
  ...isolate
}: FunctionsRunnerServiceOptions): Promise<FunctionsRunnerService> => {
  if (secret.length < 32) {
    throw new Error('The functions runner needs a secret of at least 32 characters');
  }

  let engine: FunctionRunner;
  if (runner) {
    engine = runner;
  } else {
    // Before listening: the orchestrator sends traffic once /health answers, and the first request must not be the one
    // that builds the prelude and the heap every isolate starts from.
    const isolates = createIsolateRunner(isolate);
    await isolates.warm();
    engine = isolates;
  }

  const recorder = createStatsRecorder({
    pool: 'runner',
    ...naming,
    protocol: FUNCTIONS_PROTOCOL,
    ...(version ? { version } : {})
  });
  const inFlight = { count: 0 };
  let stopping = false;
  const most = isolate.concurrency ?? DEFAULT_CONCURRENCY;
  /** When each invocation of the last `RESERVED_FOR_MS` was taken: what is still reserved beside what is held. */
  let taken: number[] = [];
  const busy = (limits: FunctionLimits): string | undefined => {
    if (stopping) {
      return 'This functions runner is stopping — a deploy or a scale-down — and takes no new invocation: another does';
    }

    if (!runner && inFlight.count >= most) {
      return `This functions runner runs ${String(most)} invocations, the most it takes at once: another runner takes it`;
    }

    const memory = readMemory();
    const reserved = limits.memoryMb * 1048576 * MEMORY_RESERVE_SHARE;
    const mb = (bytes: number) => String(Math.round(bytes / 1048576));
    const now = Date.now();
    taken = taken.filter(at => now - at < RESERVED_FOR_MS);
    if (memory.usedBytes + reserved * (taken.length + 1) <= memory.limitBytes * memoryShare) {
      const cpu = overloaded(readLoad());
      if (cpu) {
        return (
          `The functions runner is short of CPU — ${cpu} — so it took none: another runner takes it. A deployment that ` +
          'sees this often gives the runners more CPU or more instances.'
        );
      }

      taken.push(now);

      return undefined;
    }

    return (
      `The functions runner is short of memory — ${mb(memory.usedBytes)} of its ${mb(memory.limitBytes)} MB in use, ` +
      `and an invocation is kept ${mb(reserved)} of room under the ${String(Math.round(memoryShare * 100))}% it takes ` +
      'new ones up to — so it took none: another runner takes it. A deployment that sees this often gives the runners ' +
      'more memory or more instances.'
    );
  };
  // The isolates' own size; an engine handed in says nothing of its own, so its work is counted without one.
  if (!runner) {
    // Past its size an invocation waits its turn here: full is at work, and only what waits degrades it.
    // Full, it turns invocations away to other runners: near full is what its autoscaler and its health read.
    recorder.slot('isolates', most, () => inFlight.count);
  }

  const sockets = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES });
  const notFound = (res: http.ServerResponse): void => {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('');
  };
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      // Stopping, it is taken out of rotation while it finishes what it runs.
      res.writeHead(stopping ? 503 : 200, { 'content-type': 'text/plain' });
      res.end(stopping ? 'stopping' : 'ok');

      return;
    }

    const asked = new URL(req.url ?? '/', 'http://runner');
    if (req.method === 'GET' && (asked.pathname === STATS_PATH || asked.pathname === STATS_LOGS_PATH)) {
      const allowed = bearerMatches(req.headers.authorization, secret);
      res.writeHead(allowed ? 200 : 401, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      });
      const answer = (): unknown =>
        asked.pathname === STATS_LOGS_PATH
          ? readLogTail(logQueryOf(Object.fromEntries(asked.searchParams)))
          : withStopping(recorder.snapshot(), stopping);
      res.end(JSON.stringify(allowed ? answer() : { error: `${asked.pathname} is read with the runner's secret` }));

      return;
    }

    if (!answerHttp) {
      notFound(res);

      return;
    }

    if (!bearerMatches(req.headers.authorization, secret)) {
      res.writeHead(401, { 'content-type': 'text/plain' });
      res.end('');

      return;
    }

    answerHttp(req, res).then(
      taken => {
        if (!taken) {
          notFound(res);
        }
      },
      (error: unknown) => {
        serverLog.error('Functions', 'an HTTP request failed', error);
        if (!res.headersSent) {
          res.writeHead(500, { 'content-type': 'text/plain' });
        }

        res.end('');
      }
    );
  });
  server.on('upgrade', (req, socket, head) => {
    if (!bearerMatches(req.headers.authorization, secret)) {
      socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');

      return;
    }

    sockets.handleUpgrade(req, socket, head, ws =>
      serveConnection(ws, engine, { recorder, inFlight, busy, stopping: () => stopping })
    );
  });

  // Drained, not only closed, when it stops: the platform keeps a socket and keep-alive connections to it for as long
  // as it runs — and a runtime's streams (an agent listening) never end by themselves — so `server.close()` alone waited
  // for ever, and whatever was stopping it with it.
  const connections = watchConnections(server);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  if (announce) {
    serverLog.info('Functions', `runner listening on ${host}:${String(port)}`);
  }

  return {
    address: () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('The functions runner is not listening');
      }

      return address;
    },
    close: async () => {
      const { announceMs, graceMs } = shutdownOf({ ...(shutdown ? { shutdown } : {}) }, { graceMs: SHUTDOWN_GRACE_MS });
      stopping = true;
      if (announceMs > 0) {
        await new Promise(resolve => setTimeout(resolve, announceMs));
      }

      // What it runs ends on its own, within its time limit: cut only past the grace, and said.
      const deadline = Date.now() + graceMs;
      while (inFlight.count > 0 && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      if (inFlight.count > 0) {
        serverLog.warn(
          'Functions',
          `${String(inFlight.count)} invocation(s) still running ${String(graceMs)} ms after stopping: cut`
        );
      }

      sockets.clients.forEach(client => client.terminate());
      await connections.drain('Functions');
      await engine.close?.();
    }
  };
};
