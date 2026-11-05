import http from 'node:http';

import { WebSocketServer } from 'ws';

import { bearerMatches, frameText, watchConnections } from '@plitzi/sdk-kernel/http';
import { logQueryOf, readLogTail, serverLog } from '@plitzi/sdk-kernel/log';
import { STATS_LOGS_PATH, STATS_PATH, createStatsRecorder, sampleProcessMemory } from '@plitzi/sdk-kernel/stats';
import {
  FUNCTIONS_PROTOCOL,
  FunctionFailure,
  errorOfAnswer,
  isStreamedRouteAnswer,
  protocolRefusal,
  readRequestMessage
} from '@plitzi/sdk-shared/functions';

import { DEFAULT_CONCURRENCY, createIsolateRunner } from './isolate';

import type { IsolateRunnerOptions } from './isolate';
import type { MemoryReading, StatsConfig, StatsRecorder } from '@plitzi/sdk-kernel/stats';
import type {
  FunctionAnswer,
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
   * The share of its memory limit past which it takes no new invocation, from 0 to 1: 0.85 by default. Past it, the
   * platform is answered `busy` — another instance, or the same a moment later, takes it — instead of the process being
   * killed for memory with every invocation in it.
   */
  memoryShare?: number;
  /**
   * Whether it says it listens (`[Functions] runner listening on …`): what a runner of its own does. A host that runs the
   * service inside something else — a space's runtime — says what it is itself, once, and passes `false`.
   */
  announce?: boolean;
  /** How full the process is; its resident memory against its container's limit by default. For tests. */
  readMemory?: () => MemoryReading;
};

export type FunctionsRunnerService = {
  /** Where it listens, once it does. */
  address: () => AddressInfo;
  close: () => Promise<void>;
};

/** A bundle is at most 1 MB and an answer a few; anything past this on one frame is not the platform talking. */
const MAX_FRAME_BYTES = 8 * 1024 * 1024;

/**
 * One operation on one connection — `describe`, or `invoke` with every call the code makes going back on the same
 * socket. The platform replica that asked is the one answering, so nothing about a run has to be shared between
 * replicas, and a connection that closes is the invocation aborting.
 */
/** What one connection tells the runner's stats: an invocation in flight, how it ended, a version refused. */
type ConnectionStats = {
  recorder: StatsRecorder;
  inFlight: { count: number };
  /** Why this runner takes no new invocation right now, or nothing. */
  busy: () => string | undefined;
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
  const finish = (message: RunnerResponseMessage): void => {
    if (invokedAt !== undefined) {
      stats.inFlight.count -= 1;
      stats.recorder.run(Date.now() - invokedAt, message.type === 'failed' ? message.reason : undefined);
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

    const busy = stats.busy();
    if (busy) {
      stats.recorder.refuse('memory');
      finish({ type: 'failed', reason: 'busy', error: busy });

      return;
    }

    const { bundleId, invocation, limits } = message;
    invokedAt = Date.now();
    stats.inFlight.count += 1;
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
  memoryShare = 0.85,
  announce = true,
  readMemory = sampleProcessMemory(),
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

  const recorder = createStatsRecorder({ pool: 'runner', ...naming, protocol: FUNCTIONS_PROTOCOL });
  const inFlight = { count: 0 };
  const busy = (): string | undefined => {
    const memory = readMemory();
    if (memory.usedBytes <= memory.limitBytes * memoryShare) {
      return undefined;
    }

    const mb = (bytes: number) => String(Math.round(bytes / 1048576));

    return (
      `The functions runner is short of memory — ${mb(memory.usedBytes)} of its ${mb(memory.limitBytes)} MB in use, ` +
      `past the ${String(Math.round(memoryShare * 100))}% it takes new invocations up to — so it took none: try again ` +
      'shortly. A deployment that sees this often gives the runner more memory, more instances, or a lower `concurrency`.'
    );
  };
  // The isolates' own size; an engine handed in says nothing of its own, so its work is counted without one.
  if (!runner) {
    recorder.slot('isolates', isolate.concurrency ?? DEFAULT_CONCURRENCY, () => inFlight.count);
  }

  const sockets = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES });
  const notFound = (res: http.ServerResponse): void => {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('');
  };
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');

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
          : recorder.snapshot();
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

    sockets.handleUpgrade(req, socket, head, ws => serveConnection(ws, engine, { recorder, inFlight, busy }));
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
      sockets.clients.forEach(client => client.terminate());
      await connections.drain('Functions');
      await engine.close?.();
    }
  };
};
