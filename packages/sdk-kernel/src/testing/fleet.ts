import { createFleetClient, createFleetHub, createListeners, createStoreHost } from '../http/fleet/channel';

import type { FleetMessage, FleetPeer, HostedStore } from '../http/fleet/channel';

/**
 * A fleet in one process: a hub and its workers, each message cloned the way the channel clones it (structured
 * clone — what `serialization: 'advanced'` does) and delivered a turn later, as a message between processes is.
 */
export const simulatedFleet = (catalogue: Record<string, HostedStore>) => {
  const host = createStoreHost(catalogue);
  const primaryHeard: [string, unknown][] = [];
  const primary = createListeners(() => undefined);
  primary.listen('news', payload => primaryHeard.push(['news', payload]));
  const peers: FleetPeer[] = [];
  const hub = createFleetHub({ host, deliver: primary.deliver, peers: () => peers });

  const worker = (id: number) => {
    const heard: unknown[] = [];
    const listeners = createListeners(() => undefined);
    listeners.listen('news', payload => heard.push(payload));
    const client = createFleetClient(message => {
      const copy = structuredClone(message);
      setImmediate(() => void hub.receive(id, copy));
    }, listeners.deliver);
    const peer: FleetPeer = {
      id,
      send: (message: FleetMessage) => {
        const copy = structuredClone(message);
        setImmediate(() => client.receive(copy));
      }
    };
    peers.push(peer);

    return { client, heard, leave: () => peers.splice(peers.indexOf(peer), 1) };
  };

  return { hub, worker, primaryHeard };
};

/**
 * Enough turns of the event loop for a message to go out and its answer to come back — each hop is one turn
 * (`setImmediate`). Counted in turns, not in milliseconds: a busy machine reached a 20 ms timer before the second hop.
 */
export const fleetTurns = async (count = 6): Promise<void> => {
  for (let turn = 0; turn < count; turn++) {
    await new Promise(resolve => setImmediate(resolve));
  }
};
