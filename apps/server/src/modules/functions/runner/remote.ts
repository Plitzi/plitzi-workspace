import { WebSocket } from 'ws';

import { readResponseMessage } from './messages';
import { frameText } from '../../../helpers/wsFrame';
import { FUNCTIONS_PROTOCOL, FunctionFailure } from '../protocol';

import type { FunctionAnswer, FunctionRunner, FunctionsBundle, FunctionUsage, RunnerRequestMessage } from '../protocol';

export type RemoteRunnerOptions = {
  /** The runner service, `ws://functions-runner:8790`. */
  url: string;
  secret: string;
  /** How long to wait for the runner to accept a connection. */
  connectTimeoutMs?: number;
};

const unreachable = (detail: string) => new FunctionFailure('error', `The functions runner is unreachable (${detail})`);

type Operation = {
  first: RunnerRequestMessage;
  bundle: FunctionsBundle;
  answer: (call: unknown) => Promise<unknown>;
  signal?: AbortSignal;
  onUsage?: (usage: FunctionUsage) => void;
};

/**
 * The platform's side of the runner service: a {@link FunctionRunner} over one WebSocket per operation. Each call the
 * code makes arrives on it and is answered on it, by this process — the one holding the run.
 */
export const createRemoteRunner = ({ url, secret, connectTimeoutMs = 5000 }: RemoteRunnerOptions): FunctionRunner => {
  const operate = ({ first, bundle, answer, signal, onUsage }: Operation): Promise<unknown> =>
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
        signal?.removeEventListener('abort', onAbort);
        outcome();
        socket.close(1000);
      };
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
            send({ type: 'bundle', bundle });

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
        bundle,
        answer: () => Promise.reject(new Error('Nothing is reachable while a bundle is read'))
      }),
    invoke: ({ bundle, invocation, limits, answer, signal, onUsage }) =>
      operate({
        first: { type: 'invoke', protocol: FUNCTIONS_PROTOCOL, bundleId: bundle.id, invocation, limits },
        bundle,
        answer,
        signal,
        onUsage
      })
  };
};
