import cluster from 'node:cluster';

import { createFleetClient, createFleetHub, createListeners, createStoreHost, isFleetMessage } from './channel';
import { isFleetWorker } from './role';
import { serverLog } from '../../../helpers/serverLog';

import type { FleetClient, FleetHub, FleetMessage, HostedStore, Remote, StoreMethods } from './channel';

/**
 * This process's end of the fleet channel (`channel.ts`), over `node:cluster` — for a `primary` or a `worker`
 * (`role.ts`). A single server never reaches past `fleetStore`, which answers it nothing.
 */

/** The stores a single process keeps in memory by default, which the workers of a fleet share (see `stores.ts`). */
export type FleetStoreName = 'actions.kv' | 'actions.jobs' | 'ssr.drafts' | 'auth.rateLimit';

const listeners = createListeners((channel, error) =>
  serverLog.error('fleet', `a broadcast on "${channel}" failed here`, error)
);

let client: FleetClient | undefined;
let hub: FleetHub | undefined;

const workerClient = (): FleetClient => {
  if (client) {
    return client;
  }

  const created = createFleetClient(message => {
    if (!process.send) {
      throw new Error('this worker has no channel to its primary');
    }

    process.send(message);
  }, listeners.deliver);
  process.on('message', (message: unknown) => {
    if (isFleetMessage(message)) {
      created.receive(message);
    }
  });
  // The channel stays referenced: in round-robin mode it is what keeps a worker alive, since its server holds no
  // socket of its own. A worker ends when the primary signals it, not when it runs out of work.
  process.once('disconnect', () => created.close());
  client = created;

  return created;
};

/**
 * The primary's hub: it answers its workers from the stores in `catalogue`, made when first asked for, and passes
 * broadcasts on. Started before the first fork, so no worker can ask before anyone is answering.
 */
export const startHub = (catalogue: Readonly<Record<FleetStoreName, HostedStore>>): void => {
  if (hub) {
    return;
  }

  const created = createFleetHub({
    host: createStoreHost(catalogue),
    deliver: listeners.deliver,
    peers: () =>
      Object.values(cluster.workers ?? {}).flatMap(worker =>
        worker?.isConnected() ? [{ id: worker.id, send: (message: FleetMessage) => worker.send(message) }] : []
      )
  });
  cluster.on('message', (worker, message: unknown) => {
    if (isFleetMessage(message)) {
      void created.receive(worker.id, message);
    }
  });
  hub = created;
};

/** The n-th of a name this process asked for: the same code asks in the same order in every process of a fleet, so
 *  the n-th one is the same one everywhere. Counted only in a fleet — a single server never asks. */
const seen = new Map<string, number>();
const nextKey = (name: string): string => {
  const count = seen.get(name) ?? 0;
  seen.set(name, count + 1);

  return `${name}#${count}`;
};

/**
 * In a worker, the primary's copy of a store a single server keeps in memory, reached over the channel. Anywhere
 * else, nothing — so a call site reads `deployment's ?? fleetStore(…) ?? what a single server has always made`.
 */
export const fleetStore = <T extends object>(name: FleetStoreName, methods: StoreMethods<T>): Remote<T> | undefined =>
  isFleetWorker() ? workerClient().remote<T>(nextKey(name), methods) : undefined;

/** A name for one server's broadcasts, the same in the primary and in each of its workers. */
export const channelName = (label: string): string => nextKey(label);

/** Tells every other process of the fleet. */
export const broadcast = (channel: string, payload: unknown): void => {
  if (isFleetWorker()) {
    workerClient().broadcast(channel, payload);

    return;
  }

  hub?.broadcast(channel, payload);
};

/** Hears what another process of the fleet broadcast on `channel`. */
export const onBroadcast = (channel: string, listener: (payload: unknown) => void): (() => void) => {
  if (isFleetWorker()) {
    workerClient();
  }

  return listeners.listen(channel, listener);
};
