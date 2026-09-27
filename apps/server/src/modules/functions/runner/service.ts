import { createHash, timingSafeEqual } from 'node:crypto';
import http from 'node:http';

import { WebSocketServer } from 'ws';

import { readRequestMessage } from './messages';
import { serverLog } from '../../../helpers/serverLog';
import { frameText } from '../../../helpers/wsFrame';
import { FUNCTIONS_PROTOCOL, FunctionFailure } from '../protocol';
import { createIsolateRunner } from '../sandbox/isolate';

import type {
  FunctionAnswer,
  FunctionRunner,
  FunctionsBundle,
  FunctionUsage,
  RunnerResponseMessage
} from '../protocol';
import type { IsolateRunnerOptions } from '../sandbox/isolate';
import type { AddressInfo } from 'node:net';
import type { WebSocket } from 'ws';

export type FunctionsRunnerServiceOptions = IsolateRunnerOptions & {
  /** What the platform presents as `Authorization: Bearer <secret>`. Required: a runner anybody reaches runs anybody's code. */
  secret: string;
  port?: number;
  host?: string;
  /** Bundles kept by id, so a warm runner is never sent the code again. */
  bundles?: number;
  /** The engine; the isolates in this process by default. */
  runner?: FunctionRunner;
};

export type FunctionsRunnerService = {
  /** Where it listens, once it does. */
  address: () => AddressInfo;
  close: () => Promise<void>;
};

/** A bundle is at most 1 MB and an answer a few; anything past this on one frame is not the platform talking. */
const MAX_FRAME_BYTES = 8 * 1024 * 1024;

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

const authorised = (header: string | undefined, secret: string): boolean =>
  header !== undefined && timingSafeEqual(digest(header), digest(`Bearer ${secret}`));

/**
 * One operation on one connection — `describe`, or `invoke` with every call the code makes going back on the same
 * socket. The platform replica that asked is the one answering, so nothing about a run has to be shared between
 * replicas, and a connection that closes is the invocation aborting.
 */
const serveConnection = (
  socket: WebSocket,
  runner: FunctionRunner,
  bundles: Map<string, string>,
  keep: number
): void => {
  const pending = new Map<number, (answer: FunctionAnswer) => void>();
  const controller = new AbortController();
  let nextCall = 1;
  let started = false;
  let waitingBundle: ((bundle: FunctionsBundle) => void) | undefined;

  const send = (message: RunnerResponseMessage): void => {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  };
  const finish = (message: RunnerResponseMessage): void => {
    send(message);
    socket.close(1000);
  };
  const remember = (bundle: FunctionsBundle): void => {
    bundles.delete(bundle.id);
    bundles.set(bundle.id, bundle.code);
    while (bundles.size > keep) {
      const oldest = bundles.keys().next().value;
      if (oldest === undefined) {
        break;
      }

      bundles.delete(oldest);
    }
  };
  let usage: FunctionUsage | undefined;
  const settle = (work: Promise<unknown>): void => {
    work.then(
      value => finish({ type: 'done', value, ...(usage ? { usage } : {}) }),
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
      pending.set(id, reply => (reply.ok ? resolve(reply.value) : reject(new Error(reply.error))));
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
      controller.abort();

      return;
    }

    if (message.type === 'bundle') {
      remember(message.bundle);
      waitingBundle?.(message.bundle);
      waitingBundle = undefined;

      return;
    }

    if (started) {
      finish({ type: 'failed', reason: 'error', error: 'One operation per connection' });

      return;
    }

    started = true;
    if (message.protocol !== FUNCTIONS_PROTOCOL) {
      finish({
        type: 'failed',
        reason: 'error',
        error: `This runner speaks protocol ${String(FUNCTIONS_PROTOCOL)}, not ${String(message.protocol)}`
      });

      return;
    }

    if (message.type === 'describe') {
      remember(message.bundle);
      settle(runner.describe(message.bundle));

      return;
    }

    const { bundleId, invocation, limits } = message;
    const known = bundles.get(bundleId);
    const bundle =
      known === undefined
        ? new Promise<FunctionsBundle>(resolve => {
            waitingBundle = resolve;
            send({ type: 'needBundle' });
          })
        : Promise.resolve({ id: bundleId, code: known });
    settle(
      bundle.then(found =>
        runner.invoke({
          bundle: found,
          invocation,
          limits,
          answer,
          signal: controller.signal,
          onUsage: spent => {
            usage = spent;
          }
        })
      )
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
 * `GET /health` answers 200 for the orchestrator; everything else is the WebSocket protocol, behind the secret.
 */
export const startFunctionsRunnerService = async ({
  secret,
  port = 8790,
  host = '0.0.0.0',
  bundles: keep = 512,
  runner,
  ...isolate
}: FunctionsRunnerServiceOptions): Promise<FunctionsRunnerService> => {
  if (secret.length < 32) {
    throw new Error('The functions runner needs a secret of at least 32 characters');
  }

  const engine = runner ?? createIsolateRunner(isolate);
  const bundles = new Map<string, string>();
  const sockets = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES });
  const server = http.createServer((req, res) => {
    res.writeHead(req.method === 'GET' && req.url === '/health' ? 200 : 404, { 'content-type': 'text/plain' });
    res.end(req.url === '/health' ? 'ok' : '');
  });
  server.on('upgrade', (req, socket, head) => {
    if (!authorised(req.headers.authorization, secret)) {
      socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');

      return;
    }

    sockets.handleUpgrade(req, socket, head, ws => serveConnection(ws, engine, bundles, keep));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  serverLog.info('Functions', `runner listening on ${host}:${String(port)}`);

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
      await new Promise<void>(resolve => server.close(() => resolve()));
      await engine.close?.();
    }
  };
};
