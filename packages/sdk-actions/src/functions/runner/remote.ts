import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { WebSocket } from 'ws';

import { frameText } from '@plitzi/sdk-kernel/http';
import { readResponseMessage } from '@plitzi/sdk-shared/functions';
import { FUNCTIONS_PROTOCOL, FunctionFailure, failedAnswerOf } from '@plitzi/sdk-shared/functions';

import type {
  FunctionRunner,
  FunctionUsage,
  RunnerRequestMessage,
  StreamedRouteAnswer
} from '@plitzi/sdk-shared/functions';

export type RemoteRunnerOptions = {
  /**
   * The runner service, `ws://functions-runner:8790`. A function is asked once per try, with the space an invocation is
   * for (none for reading a bundle): what sends a space to the runners it is assigned to. A name that resolves to several
   * addresses — a headless Service, a network alias — is each runner behind it: an invocation is placed on one of them
   * at random, and one a runner turns away as `busy` (no isolate free, or no memory for it: it took nothing) goes to the
   * next at once. With every one full, one of them keeps it until it has room (1.3's `queue`): it waits, never fails
   * for the runners' capacity — its own time starts once one takes it.
   */
  url: string | ((spaceId?: number) => string);
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

/** How long a runner has to take or turn away an invocation once connected: it answers at once, either way. */
const ACCEPT_MS = 5000;

/** The waits between rounds while every runner is full and even the one asked to keep it turned it away (stopping). */
const FULL_WAITS_MS = [100, 250, 500, 1000];

/** How long the addresses a runner name resolves to are kept: a scale-up is seen within it. */
const RESOLVE_MS = 1000;

/**
 * A runner that went away while it ran the invocation — killed, crashed, its connection cut: the platform's, never the
 * code's, but it may have run in part (a call made, a request sent), so nothing sends it again on its own.
 */
const unreachable = (detail: string) =>
  new FunctionFailure('lost', `The functions runner went away while it ran this (${detail}): it may have run in part`);

/** A runner that turned this platform away before it opened — its secret is another's: nothing ran, nor will by asking. */
const refusedBy = (detail: string) =>
  new FunctionFailure(
    'error',
    `The functions runner turned this platform away (${detail}): its secret is not this platform's`
  );

/** A runner that was never connected to: the invocation was not sent, so nothing of it ran and it may be sent again. */
const notReached = (detail: string) =>
  new FunctionFailure('unreachable', `No functions runner could be reached (${detail})`);

/**
 * How long a runner that could not be reached is taken to be away: calls that need it are queued meanwhile rather
 * than started. The first invocation past it tries again, and says whether it is back.
 */
const AWAY_MS = 15_000;

/** The waits between tries of a runner that could not be reached: a restart takes a few seconds, an outage longer. */
const RETRY_WAITS_MS = [500, 1000, 2000];

const wait = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise(resolve => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });

type Operation = {
  first: RunnerRequestMessage;
  load: () => Promise<string>;
  bundleId: string;
  /** The runner it is placed on: one address of what `url` names. */
  address: string;
  /** When this side stops waiting once the runner took it, however the runner is doing. */
  deadlineMs: number;
  answer: (call: unknown) => Promise<unknown>;
  signal?: AbortSignal;
  onUsage?: (usage: FunctionUsage) => void;
  /**
   * Told what the invocation waited for the runners' capacity, AS it waits — placed, or kept in a runner's queue — and
   * every turn at its CPU it waited for after (1.3's `waited`).
   */
  onWaited?: (ms: number) => void;
  /** Says what it waited since it was last said, and — `taken` — that a runner took it: one count for every attempt. */
  tellWaited?: (taken: boolean) => void;
};

/** How often a wait for the runners' capacity is said while it lasts. */
const TELL_WAIT_MS = 250;

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
  /** When none of the runners a name stands for could be reached: while recent, the calls that need them are kept. */
  const away = new Map<string, number>();
  const addressOf = (spaceId?: number): string => (typeof url === 'function' ? url(spaceId) : url);
  const resolved = new Map<string, { at: number; addresses: Promise<string[]> }>();

  /** Each runner a name stands for — every address it resolves to — in an order of its own each time. */
  const runnersOf = (address: string): Promise<string[]> => {
    const named = new URL(address);
    if (isIP(named.hostname.replace(/^\[|\]$/g, '')) !== 0) {
      return Promise.resolve([address]);
    }

    const kept = resolved.get(address);
    if (!kept || Date.now() - kept.at > RESOLVE_MS) {
      resolved.set(address, {
        at: Date.now(),
        addresses: lookup(named.hostname, { all: true }).then(
          found =>
            found.map(({ address: ip, family }) => {
              const each = new URL(address);
              each.hostname = family === 6 ? `[${ip}]` : ip;

              return each.toString().replace(/\/$/, '');
            }),
          // Unresolved, the name is tried as it is: the connection says why it could not be reached.
          () => [address]
        )
      });
    }

    return (resolved.get(address)?.addresses ?? Promise.resolve([address])).then(addresses =>
      [...addresses].sort(() => Math.random() - 0.5)
    );
  };

  const operate = ({
    first,
    load,
    bundleId,
    address,
    deadlineMs,
    answer,
    signal,
    onUsage,
    onWaited,
    tellWaited
  }: Operation): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const socket = new WebSocket(address, {
        headers: { authorization: `Bearer ${secret}` },
        handshakeTimeout: connectTimeoutMs
      });
      let settled = false;
      let opened = false;
      /** A route answering as it writes: the body handed out at its head, fed until `done`. */
      let body: ReadableStreamDefaultController<Uint8Array> | undefined;
      let bodyEnded = false;
      const endBody = (end: (controller: ReadableStreamDefaultController<Uint8Array>) => void): void => {
        if (body && !bodyEnded) {
          bodyEnded = true;
          end(body);
          socket.close(1000);
        }
      };
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
      const giveUp = (ms: number, words: string) =>
        setTimeout(() => {
          settle(() => reject(new FunctionFailure('wall', words)));
          socket.terminate();
        }, ms);
      /** When the runner's answer is due: `deadlineMs` after it took it, and later by what it says it waited for its CPU. */
      let dueAt = 0;
      let waitedMs = 0;
      const answerDeadline = () =>
        giveUp(
          Math.max(0, dueAt - Date.now()),
          `The functions runner did not answer within ${String(deadlineMs)} ms of taking it` +
            (waitedMs > 0 ? `, and the ${String(waitedMs)} ms it waited for its CPU` : '')
        );
      // An invocation's time starts once a runner takes it (1.2's `accepted`); till then the runner has a moment to say.
      let accepted = first.type !== 'invoke';
      if (accepted) {
        dueAt = Date.now() + deadlineMs;
      }

      let deadline = accepted
        ? answerDeadline()
        : giveUp(connectTimeoutMs + ACCEPT_MS, 'The functions runner neither took nor turned away the invocation');
      const accept = (): void => {
        if (!accepted) {
          accepted = true;
          tellWaited?.(true);

          dueAt = Date.now() + deadlineMs;
          clearTimeout(deadline);
          deadline = answerDeadline();
        }
      };
      // Why it was asked to end goes with it: a job's slice tells its code whether it was paused, cancelled or timed.
      const onAbort = (): void =>
        send(typeof signal?.reason === 'string' ? { type: 'abort', reason: signal.reason } : { type: 'abort' });
      signal?.addEventListener('abort', onAbort, { once: true });

      socket.on('open', () => {
        opened = true;
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

        // A 1.1 runner says nothing as it takes it: whatever it says first of the invocation is that it did — but that it
        // keeps it waiting for room (`queued`), which is not taking it yet.
        if ((message.type !== 'failed' || message.reason !== 'busy') && message.type !== 'queued') {
          accept();
        }

        switch (message.type) {
          case 'accepted':
            return;
          case 'queued':
            // Kept until the runner has room: nothing to wait for but that — or its caller giving up (`signal`).
            clearTimeout(deadline);

            return;
          case 'waited':
            // The runner's time, not the code's: what it is waited for grows by it (1.3).
            if (!settled) {
              onWaited?.(message.ms);
              waitedMs += message.ms;
              dueAt += message.ms;
              clearTimeout(deadline);
              deadline = answerDeadline();
            }

            return;
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
              (error: unknown) => send({ type: 'answer', id: message.id, answer: failedAnswerOf(error) })
            );

            return;
          case 'head': {
            if (settled) {
              return;
            }

            // Answered: past this the deadline is not the runner's to keep — the visitor reads, or leaves, as long as
            // the code writes. Settled without closing the socket, which carries the body.
            settled = true;
            clearTimeout(deadline);
            const stream = new ReadableStream<Uint8Array>({
              start: controller => {
                body = controller;
              },
              cancel: () => {
                bodyEnded = true;
                send({ type: 'abort' });
                socket.close(1000);
              }
            });
            resolve({
              streamed: true,
              status: message.status,
              statusText: message.statusText,
              headers: message.headers,
              body: stream
            } satisfies StreamedRouteAnswer);

            return;
          }
          case 'chunk':
            if (body && !bodyEnded) {
              body.enqueue(
                'base64' in message.chunk
                  ? new Uint8Array(Buffer.from(message.chunk.base64, 'base64'))
                  : new TextEncoder().encode(message.chunk.text)
              );
            }

            return;
          case 'done':
            if (message.usage) {
              onUsage?.(message.usage);
            }

            if (body) {
              signal?.removeEventListener('abort', onAbort);
              endBody(controller => controller.close());

              return;
            }

            settle(() => resolve(message.value));

            return;
          case 'failed':
            if (message.usage) {
              onUsage?.(message.usage);
            }

            if (body) {
              signal?.removeEventListener('abort', onAbort);
              endBody(controller => controller.error(new FunctionFailure(message.reason, message.error)));

              return;
            }

            settle(() => reject(new FunctionFailure(message.reason, message.error)));
        }
      });
      socket.on('error', error => {
        // Refused or timed out before it opened — or answered by a runner going away (5xx): nothing was sent, which is
        // the one failure safe to try again. A runner that turned this side away (a 4xx: the secret) is not away.
        if (!opened && !/Unexpected server response: 4\d\d/.test(error.message)) {
          settle(() => reject(notReached(error.message)));

          return;
        }

        // Turned away before it opened (a 4xx): nothing ran, and asking again would be turned away the same.
        if (!opened) {
          settle(() => reject(refusedBy(error.message)));

          return;
        }

        endBody(controller => controller.error(unreachable(error.message)));
        settle(() => reject(unreachable(error.message)));
      });
      socket.on('close', code => {
        // Closed before it opened: nothing was sent, which may be sent again.
        const why = opened ? unreachable(`closed with ${String(code)}`) : notReached(`closed with ${String(code)}`);
        endBody(controller => controller.error(why));
        settle(() => reject(why));
      });
    });

  return {
    describe: async bundle =>
      operate({
        first: { type: 'describe', protocol: FUNCTIONS_PROTOCOL, bundle },
        address: (await runnersOf(addressOf()))[0] ?? addressOf(),
        load: () => Promise.resolve(bundle.code),
        bundleId: bundle.id,
        deadlineMs: DESCRIBE_DEADLINE_MS,
        answer: () => Promise.reject(new Error('Nothing is reachable while a bundle is read'))
      }),
    invoke: async ({ bundle, invocation, limits, answer, signal, onUsage, onWaited }) => {
      // Placing it is the runners' capacity, not the code's time — every attempt at it, the pauses between them, a
      // runner's queue — said as it lasts, not once it ends: a run's time limit moves by it, and told only when a runner
      // took it, a wait longer than what the run had left ended the run as over its budget before it had run at all.
      let waitedSince = Date.now();
      let taken = false;
      const tellWaited = (tookIt: boolean): void => {
        if (taken) {
          return;
        }

        const now = Date.now();
        if (now > waitedSince) {
          onWaited?.(now - waitedSince);
          waitedSince = now;
        }

        if (tookIt) {
          taken = true;
          clearInterval(waiting);
        }
      };
      const waiting = onWaited ? setInterval(() => tellWaited(false), TELL_WAIT_MS) : undefined;
      const attempt = (address: string, queue = false) =>
        operate({
          first: {
            type: 'invoke',
            protocol: FUNCTIONS_PROTOCOL,
            bundleId: bundle.id,
            invocation,
            limits,
            ...(queue ? { queue: true } : {})
          },
          load: bundle.load,
          bundleId: bundle.id,
          address,
          deadlineMs: limits.wallMs + graceMs,
          answer,
          signal,
          onUsage,
          ...(onWaited ? { onWaited, tellWaited } : {})
        });
      try {
        const name = addressOf(invocation.context.spaceId);
        let unreachableRounds = 0;

        // A round tries each runner the space may run on once: a busy one took nothing, an unreachable one was sent
        // nothing, so the invocation is whole to give the next. With every one full, one of them keeps it until it has
        // room (`queue`) — it waits, never fails for the runners' capacity; while none can be reached, rounds go on a few
        // times: a restart, a rolling deploy.
        for (let round = 0; ; round += 1) {
          const tried = new Set<string>();
          let last: unknown;
          const full: string[] = [];
          for (;;) {
            const untried = (await runnersOf(addressOf(invocation.context.spaceId))).filter(each => !tried.has(each));
            const next = untried.at(0);
            if (next === undefined) {
              break;
            }

            tried.add(next);
            try {
              const value = await attempt(next);
              away.delete(name);

              return value;
            } catch (error) {
              const reason = error instanceof FunctionFailure ? error.reason : undefined;
              if (reason !== 'busy' && reason !== 'unreachable') {
                throw error;
              }

              if (reason === 'busy') {
                full.push(next);
              }

              last = error;
            }
          }

          if (signal.aborted) {
            throw last;
          }

          if (full.length > 0) {
            // Kept by one of them at random — the next to have room takes it. One that turns even that away is stopping
            // (or speaks 1.2): the next round, a moment later, places it again.
            const keeper = full[Math.floor(Math.random() * full.length)];
            try {
              const value = await attempt(keeper, true);
              away.delete(name);

              return value;
            } catch (error) {
              if (!(error instanceof FunctionFailure && error.reason === 'busy')) {
                throw error;
              }
            }

            await wait(FULL_WAITS_MS[Math.min(round, FULL_WAITS_MS.length - 1)] ?? 1000, signal);
            continue;
          }

          // Not one of its runners could be reached: calls that need them are kept meanwhile (`reachable`).
          away.set(name, Date.now());
          const pause = RETRY_WAITS_MS.at(unreachableRounds);
          unreachableRounds += 1;
          if (pause === undefined) {
            throw last;
          }

          await wait(pause, signal);
        }
      } finally {
        // Taken, given up, or failed: what it waited is said, and nothing goes on saying it.
        clearInterval(waiting);
      }
    },
    reachable: spaceId => {
      const since = away.get(addressOf(spaceId));

      return since === undefined || Date.now() - since > AWAY_MS;
    }
  };
};
