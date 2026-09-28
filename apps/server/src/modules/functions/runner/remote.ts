import { WebSocket } from 'ws';

import { readResponseMessage } from './messages';
import { frameText } from '../../../helpers/wsFrame';
import { FUNCTIONS_PROTOCOL, FunctionFailure } from '../protocol';

import type { FunctionAnswer, FunctionRunner, FunctionUsage, RunnerRequestMessage } from '../protocol';

export type RemoteRunnerOptions = {
  /** The runner service, `ws://functions-runner:8790`. */
  url: string;
  secret: string;
  /** How long to wait for the runner to accept a connection. */
  connectTimeoutMs?: number;
  /**
   * How long past an invocation's own wall limit this side waits before giving up on the runner and closing the socket.
   * The runner stops an invocation at its limit and says so; this is for a runner that no longer says anything, so a
   * connection never outlives the work it was for.
   */
  graceMs?: number;
};

/** What reading a bundle may take on the runner (its own ceiling is 5 s), and then some. */
const DESCRIBE_DEADLINE_MS = 10_000;

const unreachable = (detail: string) => new FunctionFailure('error', `The functions runner is unreachable (${detail})`);

type Operation = {
  first: RunnerRequestMessage;
  load: () => Promise<string>;
  bundleId: string;
  /** When this side stops waiting, however the runner is doing. */
  deadlineMs: number;
  answer: (call: unknown) => Promise<unknown>;
  signal?: AbortSignal;
  onUsage?: (usage: FunctionUsage) => void;
};

/**
 * The platform's side of the runner service: a {@link FunctionRunner} over one WebSocket per operation. Each call the
 * code makes arrives on it and is answered on it, by this process — the one holding the run.
 */
export const createRemoteRunner = ({
  url,
  secret,
  connectTimeoutMs = 5000,
  graceMs = 5000
}: RemoteRunnerOptions): FunctionRunner => {
  const operate = ({ first, load, bundleId, deadlineMs, answer, signal, onUsage }: Operation): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const socket = new WebSocket(url, {
        headers: { authorization: `Bearer ${secret}` },
        handshakeTimeout: connectTimeoutMs
      });
      let settled = false;
      const send = (message: RunnerRequestMessage): void => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(message));
        }
      };
      const settle = (outcome: () => void): void => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(deadline);
        signal?.removeEventListener('abort', onAbort);
        outcome();
        socket.close(1000);
      };
      const deadline = setTimeout(() => {
        settle(() =>
          reject(new FunctionFailure('wall', `The functions runner did not answer within ${String(deadlineMs)} ms`))
        );
        socket.terminate();
      }, deadlineMs);
      const onAbort = (): void => send({ type: 'abort' });
      signal?.addEventListener('abort', onAbort, { once: true });

      socket.on('open', () => {
        send(first);
        if (signal?.aborted) {
          onAbort();
        }
      });
      socket.on('message', data => {
        const message = readResponseMessage(frameText(data));
        if (!message) {
          settle(() => reject(new FunctionFailure('error', 'The functions runner answered outside the protocol')));

          return;
        }

        switch (message.type) {
          case 'needBundle':
            // Only now, and only for a runner that has never kept this bundle: a run carries no code otherwise.
            load().then(
              code => send({ type: 'bundle', bundle: { id: bundleId, code } }),
              (error: unknown) =>
                settle(() =>
                  reject(
                    new FunctionFailure(
                      'error',
                      `The functions could not be read: ${error instanceof Error ? error.message : String(error)}`
                    )
                  )
                )
            );

            return;
          case 'call':
            answer(message.call).then(
              value => send({ type: 'answer', id: message.id, answer: { ok: true, value: value ?? null } }),
              (error: unknown) =>
                send({
                  type: 'answer',
                  id: message.id,
                  answer: {
                    ok: false,
                    error: error instanceof Error ? error.message : String(error)
                  } satisfies FunctionAnswer
                })
            );

            return;
          case 'done':
            if (message.usage) {
              onUsage?.(message.usage);
            }

            settle(() => resolve(message.value));

            return;
          case 'failed':
            if (message.usage) {
              onUsage?.(message.usage);
            }

            settle(() => reject(new FunctionFailure(message.reason, message.error)));
        }
      });
      socket.on('error', error => settle(() => reject(unreachable(error.message))));
      socket.on('close', code => settle(() => reject(unreachable(`closed with ${String(code)}`))));
    });

  return {
    describe: bundle =>
      operate({
        first: { type: 'describe', protocol: FUNCTIONS_PROTOCOL, bundle },
        load: () => Promise.resolve(bundle.code),
        bundleId: bundle.id,
        deadlineMs: DESCRIBE_DEADLINE_MS,
        answer: () => Promise.reject(new Error('Nothing is reachable while a bundle is read'))
      }),
    invoke: ({ bundle, invocation, limits, answer, signal, onUsage }) =>
      operate({
        first: { type: 'invoke', protocol: FUNCTIONS_PROTOCOL, bundleId: bundle.id, invocation, limits },
        load: bundle.load,
        bundleId: bundle.id,
        deadlineMs: limits.wallMs + graceMs,
        answer,
        signal,
        onUsage
      })
  };
};
