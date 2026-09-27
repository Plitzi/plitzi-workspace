import { describe, expect, it, vi } from 'vitest';

import {
  createFleetClient,
  createFleetHub,
  createListeners,
  createStoreHost,
  hostable,
  isFleetMessage
} from './channel';
import { createMemoryJobQueue, JOB_QUEUE_METHODS } from '../../../modules/actions/jobs/memoryQueue';
import { describeJobQueue, describeKv } from '../../../modules/actions/jobs/testing/jobQueueContract';
import { createMemoryKv, KV_METHODS } from '../../../modules/actions/runtime/memoryKv';

import type { FleetMessage, FleetPeer, HostedStore } from './channel';
import type { ActionKvAdapter } from '../../../modules/actions/types';
import type { ActionJobQueue } from '@plitzi/sdk-shared';

/**
 * A fleet in one process: a hub and its workers, each message cloned the way the channel clones it (structured
 * clone — what `serialization: 'advanced'` does) and delivered a turn later, as a message between processes is.
 */
const simulatedFleet = (catalogue: Record<string, HostedStore>) => {
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

const turns = () => new Promise(resolve => setTimeout(resolve, 20));

describe('the fleet channel', () => {
  it('answers a worker from the store the primary holds', async () => {
    const fleet = simulatedFleet({ kv: hostable(() => createMemoryKv(), KV_METHODS) });
    const kv = fleet.worker(1).client.remote<ActionKvAdapter>('kv#0', KV_METHODS);

    await kv.set('greeting', 'hola');

    expect(await kv.get('greeting')).toBe('hola');
    expect(await fleet.worker(2).client.remote<ActionKvAdapter>('kv#0', KV_METHODS).get('greeting')).toBe('hola');
  });

  it('counts every increment once, however the workers interleave them', async () => {
    const fleet = simulatedFleet({ kv: hostable(() => createMemoryKv(), KV_METHODS) });
    const workers = [1, 2, 3, 4].map(id => fleet.worker(id).client.remote<ActionKvAdapter>('kv#0', KV_METHODS));

    const answers = await Promise.all(
      Array.from({ length: 200 }, (_, index) => workers[index % workers.length].increment('hits', 1))
    );

    // Atomic: every caller saw a different total, so exactly one of them saw 1 — the single-flight rule.
    expect(new Set(answers).size).toBe(200);
    expect(Math.max(...answers)).toBe(200);
    expect(answers.filter(total => total === 1)).toHaveLength(1);
  });

  it('brings dates back as dates', async () => {
    const fleet = simulatedFleet({ jobs: hostable(() => createMemoryJobQueue(), JOB_QUEUE_METHODS) });
    const queue = fleet.worker(1).client.remote<ActionJobQueue>('jobs#0', JOB_QUEUE_METHODS);

    expect(await queue.now()).toBeInstanceOf(Date);
  });

  it('makes a store the first time a worker asks for it, and only then', async () => {
    const create = vi.fn(() => createMemoryKv());
    const fleet = simulatedFleet({ kv: hostable(create, KV_METHODS) });
    const one = fleet.worker(1).client.remote<ActionKvAdapter>('kv#0', KV_METHODS);
    const two = fleet.worker(2).client.remote<ActionKvAdapter>('kv#0', KV_METHODS);

    expect(create).not.toHaveBeenCalled();
    await one.set('a', '1');
    expect(await two.get('a')).toBe('1');
    expect(create).toHaveBeenCalledTimes(1);

    // The second of a kind is a store of its own.
    await fleet.worker(3).client.remote<ActionKvAdapter>('kv#1', KV_METHODS).set('a', '2');
    expect(await one.get('a')).toBe('1');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('refuses a kind it does not know', async () => {
    const fleet = simulatedFleet({ store: hostable(() => ({ read: () => 'ok' }), { read: true }) });
    const { client } = fleet.worker(1);

    await expect(client.call('__proto__#0', 'read', [])).rejects.toThrow(/no store "__proto__#0"/);
    await expect(client.call('toString#0', 'read', [])).rejects.toThrow(/no store "toString#0"/);
    await expect(client.call('store', 'read', [])).rejects.toThrow(/no store "store"/);
  });

  it('refuses a store it does not hold, and a member it was not registered with', async () => {
    const fleet = simulatedFleet({ store: hostable(() => ({ read: () => 'ok' }), { read: true }) });
    const { client } = fleet.worker(1);

    await expect(client.call('missing#0', 'read', [])).rejects.toThrow(/no store "missing#0"/);
    await expect(client.call('store#0', 'constructor', [])).rejects.toThrow(/method "constructor"/);
    await expect(client.call('store#0', 'toString', [])).rejects.toThrow(/method "toString"/);
    expect(await client.call('store#0', 'read', [])).toBe('ok');
  });

  it('fails the call when the store throws, with its message', async () => {
    const fleet = simulatedFleet({
      store: hostable(() => ({ boom: () => Promise.reject(new Error('disk full')) }), { boom: true })
    });

    await expect(fleet.worker(1).client.call('store#0', 'boom', [])).rejects.toThrow('[fleet] disk full');
  });

  it('fails a call whose arguments cannot cross, rather than waiting forever', async () => {
    const fleet = simulatedFleet({ store: hostable(() => ({ take: (value: unknown) => value }), { take: true }) });
    const { client } = fleet.worker(1);

    await expect(client.call('store#0', 'take', [() => 'a function'])).rejects.toThrow(/could not be sent/);
    // The channel is still good for the next call.
    expect(await client.call('store#0', 'take', ['plain'])).toBe('plain');
  });

  it('fails what is in flight when the primary goes, and everything after', async () => {
    let release: () => void = () => undefined;
    const slow = { slow: () => new Promise<void>(resolve => (release = resolve)) };
    const fleet = simulatedFleet({ store: hostable(() => slow, { slow: true }) });
    const { client } = fleet.worker(1);

    const inFlight = client.call('store#0', 'slow', []);
    await turns();
    client.close();

    await expect(inFlight).rejects.toThrow(/the primary is gone/);
    await expect(client.call('store#0', 'slow', [])).rejects.toThrow(/the primary is gone/);
    release();
  });

  it('answers nobody when the worker that asked has gone', async () => {
    const fleet = simulatedFleet({ store: hostable(() => ({ read: () => 'ok' }), { read: true }) });
    const first = fleet.worker(1);
    const call = first.client.call('store#0', 'read', []);
    first.leave();

    await turns();

    // Nothing thrown in the primary; the call simply never settles for a process that is not there.
    await expect(Promise.race([call, turns().then(() => 'unanswered')])).resolves.toBe('unanswered');
  });

  it('passes a broadcast to every other process, the primary included, and not back to its sender', async () => {
    const fleet = simulatedFleet({});
    const [one, two, three] = [1, 2, 3].map(id => fleet.worker(id));

    one.client.broadcast('news', { op: 'clear' });
    await turns();

    expect(one.heard).toEqual([]);
    expect(two.heard).toEqual([{ op: 'clear' }]);
    expect(three.heard).toEqual([{ op: 'clear' }]);
    expect(fleet.primaryHeard).toEqual([['news', { op: 'clear' }]]);
  });

  it('broadcasts from the primary to every worker', async () => {
    const fleet = simulatedFleet({});
    const [one, two] = [1, 2].map(id => fleet.worker(id));

    fleet.hub.broadcast('news', 'hello');
    await turns();

    expect(one.heard).toEqual(['hello']);
    expect(two.heard).toEqual(['hello']);
  });

  it('keeps delivering when one listener throws, and reports it', () => {
    const onError = vi.fn();
    const listeners = createListeners(onError);
    const after = vi.fn();
    listeners.listen('news', () => {
      throw new Error('bad listener');
    });
    listeners.listen('news', after);

    listeners.deliver('news', 1);

    expect(after).toHaveBeenCalledWith(1);
    expect(onError).toHaveBeenCalledWith('news', expect.objectContaining({ message: 'bad listener' }));
  });

  it('stops hearing once a listener is removed', () => {
    const listeners = createListeners(() => undefined);
    const heard = vi.fn();
    const stop = listeners.listen('news', heard);

    stop();
    listeners.deliver('news', 1);

    expect(heard).not.toHaveBeenCalled();
  });

  it('tells its own messages from everything else on the channel', () => {
    expect(isFleetMessage({ sdkFleet: 'call', id: 1, store: 's', method: 'm', args: [] })).toBe(true);
    expect(isFleetMessage({ sdkFleet: 'reply', id: 1, ok: true, value: 1 })).toBe(true);
    expect(isFleetMessage({ sdkFleet: 'broadcast', channel: 'c', payload: null })).toBe(true);

    expect(isFleetMessage({ cmd: 'NODE_CLUSTER', act: 'online' })).toBe(false);
    expect(isFleetMessage({ sdkFleet: 'call', id: '1', store: 's', method: 'm', args: [] })).toBe(false);
    expect(isFleetMessage({ sdkFleet: 'call', id: 1, store: 's', method: 'm' })).toBe(false);
    expect(isFleetMessage({ sdkFleet: 'shout' })).toBe(false);
    expect(isFleetMessage('call')).toBe(false);
    expect(isFleetMessage(null)).toBe(false);
  });
});

// The primary's stores as a worker reaches them keep the contract the stores keep in one process.
describeJobQueue('memory, over the fleet channel', () => {
  const fleet = simulatedFleet({ jobs: hostable(() => createMemoryJobQueue(), JOB_QUEUE_METHODS) });

  return Promise.resolve({
    queue: fleet.worker(1).client.remote<ActionJobQueue>('jobs#0', JOB_QUEUE_METHODS),
    clear: () => Promise.resolve()
  });
});

describeKv('memory, over the fleet channel', () => {
  const fleet = simulatedFleet({ kv: hostable(() => createMemoryKv(), KV_METHODS) });

  return Promise.resolve({
    kv: fleet.worker(1).client.remote<ActionKvAdapter>('kv#0', KV_METHODS),
    clear: () => Promise.resolve()
  });
});
