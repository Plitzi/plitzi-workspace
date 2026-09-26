import { JOIN_TYPE, LEAVE_TYPE } from '@plitzi/sdk-shared/realtime';

import type { ChannelDeclaration, PubSubAdapter, RealtimeMessage, RealtimeSender } from '@plitzi/sdk-shared';

/** The space a connection belongs to: its topics are that space's and no other's. */
export type RealtimeSpace = { spaceId: number; environment: string };

/** One page, connected. */
export type RealtimeConnection = {
  /** Its public name — the `from` of everything it sends. */
  id: string;
  /** Its secret: what a publish proves it comes from this connection with. Never sent to anyone else. */
  token: string;
  space: RealtimeSpace;
  user?: RealtimeSender['user'];
  /** The topics it subscribed to, with the channel each falls under. */
  topics: Map<string, ChannelDeclaration>;
  /** The topics it announced itself on, which hear `$leave` when it goes. */
  announced: Set<string>;
  /** Messages sent this second, by topic — the rate a channel allows is per connection, and a connection is here. */
  sent: Map<string, { second: number; count: number }>;
  send: (event: string, data: unknown) => void;
};

/** A space's topic, as the adapter knows it: namespaced, so two spaces never hear each other. */
export const adapterTopic = ({ spaceId, environment }: RealtimeSpace, topic: string): string =>
  `${spaceId}/${environment}/${topic}`;

/** A message as the adapter carried it — written by this module, but read from a transport that is not. */
const isMessage = (value: unknown): value is RealtimeMessage =>
  typeof value === 'object' &&
  value !== null &&
  'topic' in value &&
  typeof value.topic === 'string' &&
  'type' in value &&
  typeof value.type === 'string' &&
  'from' in value &&
  typeof value.from === 'string' &&
  'at' in value &&
  typeof value.at === 'number';

const parse = (raw: string): RealtimeMessage | undefined => {
  try {
    const value: unknown = JSON.parse(raw);

    return isMessage(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

export type RealtimeHub = ReturnType<typeof createRealtimeHub>;

/**
 * This process's connections, and the ONE adapter subscription per topic they share.
 *
 * A hundred pages on one board are a hundred connections here and a single subscription to the adapter: a message
 * arrives once and is written to each of them. The last one to leave a topic unsubscribes it.
 */
export const createRealtimeHub = (pubsub: PubSubAdapter) => {
  const byToken = new Map<string, RealtimeConnection>();
  const local = new Map<string, { connections: Set<RealtimeConnection>; release: Promise<() => Promise<void>> }>();

  const publish = (space: RealtimeSpace, message: RealtimeMessage): Promise<void> =>
    pubsub.publish(adapterTopic(space, message.topic), JSON.stringify(message));

  const join = async (connection: RealtimeConnection, topic: string): Promise<void> => {
    const key = adapterTopic(connection.space, topic);
    let entry = local.get(key);
    if (!entry) {
      const connections = new Set<RealtimeConnection>();
      const release = pubsub.subscribe(key, raw => {
        const message = parse(raw);
        if (message) {
          connections.forEach(member => member.send('message', message));
        }
      });
      entry = { connections, release };
      local.set(key, entry);
    }

    entry.connections.add(connection);
    await entry.release;
  };

  const leave = async (connection: RealtimeConnection, topic: string): Promise<void> => {
    const key = adapterTopic(connection.space, topic);
    const entry = local.get(key);
    if (!entry) {
      return;
    }

    entry.connections.delete(connection);
    if (entry.connections.size === 0) {
      local.delete(key);
      await (
        await entry.release
      )();
    }
  };

  /** A stamped message from this connection: `from` and `user` are the server's, whatever was sent. */
  const from = (connection: RealtimeConnection, topic: string, type: string, data: unknown): RealtimeMessage => ({
    topic,
    type,
    data,
    from: connection.id,
    ...(connection.user ? { user: connection.user } : {}),
    at: Date.now()
  });

  return {
    publish,
    from,
    find: (token: string): RealtimeConnection | undefined => byToken.get(token),

    /** Subscribes a new connection to its topics, and tells the members of each presence channel it arrived. */
    connect: async (connection: RealtimeConnection): Promise<void> => {
      byToken.set(connection.token, connection);
      for (const [topic, declaration] of connection.topics) {
        await join(connection, topic);
        if (declaration.presence) {
          await publish(connection.space, from(connection, topic, JOIN_TYPE, null));
        }
      }
    },

    /** Unsubscribes a connection that went away, and tells the channels it announced itself on. */
    disconnect: async (connection: RealtimeConnection): Promise<void> => {
      byToken.delete(connection.token);
      for (const topic of connection.topics.keys()) {
        if (connection.announced.has(topic)) {
          await publish(connection.space, from(connection, topic, LEAVE_TYPE, null));
        }

        await leave(connection, topic);
      }
    },

    /** How many topics this process holds a subscription for — for tests and for a health endpoint. */
    get topicCount(): number {
      return local.size;
    }
  };
};
