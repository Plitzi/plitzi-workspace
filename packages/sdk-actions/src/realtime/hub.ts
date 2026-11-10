import { randomUUID } from 'node:crypto';

import { JOIN_TYPE, LEAVE_TYPE, REVOKED_TYPE } from '@plitzi/sdk-shared/realtime';

import { warnRealtime } from './failure';
import { isMessage } from './message';
import { PRESENCE_HEARTBEAT_MS } from './presence';

import type { RealtimePresence } from './presence';
import type { RealtimeRetained } from './retained';
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
  /** The grant each topic of a `grant: true` channel was opened with — what a revoke names. */
  grants: Map<string, string>;
  /** The topics it announced itself on, which hear `$leave` when it goes. */
  announced: Set<string>;
  /** A page that watches (`page check`, `page shot`): it hears its topics, arrives on none and says nothing on any. */
  observer: boolean;
  /** Messages sent this second, by topic — the rate a channel allows is per connection, and a connection is here. */
  sent: Map<string, { second: number; count: number }>;
  send: (event: string, data: unknown) => void;
  /** Closes it from the server's side — the server is going away. Its own `close` then lets it go as any other. */
  end: () => void;
};

/** A space's topic, as the adapter knows it: namespaced, so two spaces never hear each other. */
export const adapterTopic = ({ spaceId, environment }: RealtimeSpace, topic: string): string =>
  `${spaceId}/${environment}/${topic}`;

/**
 * Said between the servers, never to a page: every connection opened with the grant it names — or, naming none, with
 * any grant for the topic — is let go of it. On the topic's own adapter channel, so it reaches every replica holding
 * the topic, and only them. A page cannot send it: the types a page or a flow may use have no `$` but `$presence`.
 */
const REVOKE_TYPE = '$revoke';

const revokedGrant = (data: unknown): string | undefined =>
  typeof data === 'object' && data !== null && 'grant' in data && typeof data.grant === 'string'
    ? data.grant
    : undefined;

const parse = (raw: string): RealtimeMessage | undefined => {
  try {
    const value: unknown = JSON.parse(raw);

    return isMessage(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

/** What a relayed publish is answered with: the status, and what a refusal says. */
export type RelayedAnswer = { status: number; error?: string; reason?: string };

/**
 * How a hub answers a page whose connection another replica holds (`ask`). Over Server-Sent Events a page publishes with
 * a request, and with two replicas and no affinity that request reaches the one that did not open its stream — which
 * knew nothing of its token and answered 401. Absent, a hub answers only its own connections' (a runner's, that holds
 * none).
 */
export type HubRelay = {
  /** What the replica holding the connection answers the publish with (`publishFrom`): its rate, its presence. */
  answer: (connection: RealtimeConnection, publish: Record<string, unknown>) => Promise<RelayedAnswer>;
  /** How long a replica waits for the one holding the token, in ms: past it, nobody does. */
  waitMs?: number;
};

/** Every replica's: a publish whose connection the replica it reached does not hold. */
const RELAY_REQUESTS = '$relay:publish';
/** One replica's own: the answers to what it asked. */
const relayReplies = (instance: string): string => `$relay:answers:${instance}`;
const RELAY_WAIT_MS = 1500;
/** A connection's token as `connectionFor` makes it: 24 bytes, base64url. Anything else is asked of nobody. */
const TOKEN = /^[A-Za-z0-9_-]{32}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

const relayRequestOf = (
  raw: string
): { id: string; replyTo: string; token: string; publish: Record<string, unknown> } | undefined => {
  const value = parseJson(raw);

  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.replyTo === 'string' &&
    typeof value.token === 'string' &&
    isRecord(value.publish)
    ? { id: value.id, replyTo: value.replyTo, token: value.token, publish: value.publish }
    : undefined;
};

const relayReplyOf = (raw: string): { id: string; answer: RelayedAnswer } | undefined => {
  const value = parseJson(raw);
  if (!isRecord(value) || typeof value.id !== 'string' || !isRecord(value.answer)) {
    return undefined;
  }

  const { status, error, reason } = value.answer;

  return typeof status === 'number'
    ? {
        id: value.id,
        answer: {
          status,
          ...(typeof error === 'string' ? { error } : {}),
          ...(typeof reason === 'string' ? { reason } : {})
        }
      }
    : undefined;
};

export type RealtimeHub = ReturnType<typeof createRealtimeHub>;

/**
 * This process's connections, and the ONE adapter subscription per topic they share.
 *
 * A hundred pages on one board are a hundred connections here and a single subscription to the adapter: a message
 * arrives once and is written to each of them. The last one to leave a topic unsubscribes it.
 */
export const createRealtimeHub = (
  pubsub: PubSubAdapter,
  retained: RealtimeRetained,
  presence?: RealtimePresence,
  relay?: HubRelay
) => {
  const byToken = new Map<string, RealtimeConnection>();
  const instance = randomUUID();
  /** What this replica asked another, by the request's id, until it is answered or the wait runs out. */
  const asked = new Map<string, (answer: RelayedAnswer | undefined) => void>();
  // A subscription the bus refused is said and stands for none: the relay is down, and a page is answered 401 as before.
  const subscribed = (topic: string, listener: (raw: string) => void): Promise<() => Promise<void>> =>
    pubsub.subscribe(topic, listener).catch((error: unknown) => {
      warnRealtime(`the relay of publishes between replicas could not listen on ${topic}`)(error);

      return () => Promise.resolve();
    });
  const relaying = relay
    ? [
        // The replica holding the connection answers, as it answers its own; every other one hears and passes.
        subscribed(RELAY_REQUESTS, raw => {
          const request = relayRequestOf(raw);
          const connection = request ? byToken.get(request.token) : undefined;
          if (!request || !connection) {
            return;
          }

          relay
            .answer(connection, request.publish)
            .then(answer => pubsub.publish(relayReplies(request.replyTo), JSON.stringify({ id: request.id, answer })))
            .catch(warnRealtime('a publish relayed from another replica was not answered'));
        }),
        subscribed(relayReplies(instance), raw => {
          const reply = relayReplyOf(raw);
          if (reply) {
            asked.get(reply.id)?.(reply.answer);
          }
        })
      ]
    : [];
  /** The presence topics a connection is counted on: those of a `presence: true` channel, for a page that is not watching. */
  const counted = (connection: RealtimeConnection): string[] =>
    connection.observer
      ? []
      : [...connection.topics].flatMap(([topic, declaration]) => (declaration.presence ? [topic] : []));
  const memberOf = (connection: RealtimeConnection) => ({
    from: connection.id,
    ...(connection.user ? { user: connection.user } : {}),
    since: Date.now()
  });
  // Every replica says its members are still there: one that went down stops counting (`PRESENCE_STALE_MS`).
  const heartbeat = presence
    ? setInterval(() => {
        const byTopic = new Map<
          string,
          { space: RealtimeSpace; topic: string; members: ReturnType<typeof memberOf>[] }
        >();
        for (const connection of byToken.values()) {
          for (const topic of counted(connection)) {
            const key = adapterTopic(connection.space, topic);
            const entry = byTopic.get(key) ?? { space: connection.space, topic, members: [] };
            entry.members.push(memberOf(connection));
            byTopic.set(key, entry);
          }
        }

        for (const { space, topic, members } of byTopic.values()) {
          presence.touch(space, topic, members).catch(warnRealtime(`"${topic}"'s presence was not refreshed`));
        }
      }, PRESENCE_HEARTBEAT_MS)
    : undefined;
  heartbeat?.unref();
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
        if (message?.type === REVOKE_TYPE) {
          const grant = revokedGrant(message.data);
          const revoked = [...connections].filter(member => {
            const opened = member.grants.get(message.topic);

            return opened !== undefined && (grant === undefined || opened === grant);
          });
          revoked.forEach(member => {
            releaseTopic(member, message.topic).catch(warnRealtime(`"${message.topic}" was not let go`));
          });
        } else if (message) {
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

  /**
   * A stamped message from this connection: `from` and `user` are the server's, whatever was sent. `echo` carries the
   * sender's asking to hear it too, which its page reads.
   */
  const from = (
    connection: RealtimeConnection,
    topic: string,
    type: string,
    data: unknown,
    echo = false
  ): RealtimeMessage => ({
    topic,
    type,
    data,
    from: connection.id,
    ...(connection.user ? { user: connection.user } : {}),
    at: Date.now(),
    ...(echo ? { echo: true } : {})
  });

  /**
   * Lets `connection` go of `topic`: it is told, the others on a presence channel hear it leave, and it no longer
   * hears the topic or may send on it.
   */
  const releaseTopic = async (connection: RealtimeConnection, topic: string): Promise<void> => {
    connection.send('message', { topic, type: REVOKED_TYPE, data: null, from: 'server', at: Date.now() });
    connection.topics.delete(topic);
    connection.grants.delete(topic);
    await leave(connection, topic);
    if (connection.announced.delete(topic)) {
      await publish(connection.space, from(connection, topic, LEAVE_TYPE, null));
    }
  };

  return {
    publish,
    from,
    find: (token: string): RealtimeConnection | undefined => byToken.get(token),

    /**
     * A publish whose connection this replica does not hold, asked of the replica that does — answered as it answers its
     * own — or `undefined` when none answers within the wait (no such connection anywhere, or no relay).
     */
    ask: async (token: string, publish: Record<string, unknown>): Promise<RelayedAnswer | undefined> => {
      if (!relay || !TOKEN.test(token)) {
        return undefined;
      }

      await Promise.all(relaying);
      const id = randomUUID();

      return new Promise<RelayedAnswer | undefined>(resolve => {
        const done = (answer: RelayedAnswer | undefined): void => {
          clearTimeout(timer);
          asked.delete(id);
          resolve(answer);
        };
        const timer = setTimeout(() => done(undefined), relay.waitMs ?? RELAY_WAIT_MS);
        timer.unref();
        asked.set(id, done);
        pubsub
          .publish(RELAY_REQUESTS, JSON.stringify({ id, replyTo: instance, token, publish }))
          .catch((error: unknown) => {
            warnRealtime('a publish could not be relayed to the replica holding its connection')(error);
            done(undefined);
          });
      });
    },

    /**
     * Lets go of `topic` every connection, on every replica, that opened it with `grant` — or with any grant, naming
     * none. What stops a grant that is already in use; `grants.revoke` is what stops it being used again.
     */
    revoke: (space: RealtimeSpace, topic: string, grant?: string): Promise<void> =>
      publish(space, {
        topic,
        type: REVOKE_TYPE,
        data: grant === undefined ? null : { grant },
        from: 'server',
        at: Date.now()
      }),

    /**
     * Subscribes a new connection to its topics, hands it what each `retain: true` one keeps, and tells the members of
     * each presence channel it arrived. What is kept is read AFTER joining, so nothing said in between is missed; a
     * message heard live and then kept arrives twice, and the page keeps the newer of a type by its `at`. Each kept one
     * is `replayed`: a page that joins tells it from what is said now.
     */
    connect: async (connection: RealtimeConnection): Promise<void> => {
      byToken.set(connection.token, connection);
      for (const [topic, declaration] of connection.topics) {
        await join(connection, topic);
        if (declaration.retain === true) {
          (await retained.of(connection.space, topic)).forEach(message =>
            connection.send('message', { ...message, replayed: true })
          );
        }

        if (declaration.presence && !connection.observer) {
          await publish(connection.space, from(connection, topic, JOIN_TYPE, null));
          await presence
            ?.touch(connection.space, topic, [memberOf(connection)])
            .catch(warnRealtime(`"${topic}"'s presence was not recorded`));
        }
      }
    },

    /** Unsubscribes a connection that went away, and tells the channels it announced itself on. */
    disconnect: async (connection: RealtimeConnection): Promise<void> => {
      byToken.delete(connection.token);
      for (const topic of counted(connection)) {
        await presence
          ?.depart(connection.space, topic, connection.id)
          .catch(warnRealtime(`"${topic}"'s presence was not let go of`));
      }

      for (const topic of connection.topics.keys()) {
        if (connection.announced.has(topic)) {
          await publish(connection.space, from(connection, topic, LEAVE_TYPE, null));
        }

        await leave(connection, topic);
      }
    },

    /**
     * Every connection closed from here: the server is shutting down. An open socket or event stream is a request that
     * never ends, so a server waiting for them to finish waited for ever — each is told to go, and goes the way it
     * goes when its page leaves.
     */
    closeAll: (): void => {
      clearInterval(heartbeat);
      asked.forEach(done => done(undefined));
      void Promise.all(relaying)
        .then(releases => Promise.all(releases.map(release => release())))
        .catch(warnRealtime('the relay between replicas was not let go'));
      [...byToken.values()].forEach(connection => connection.end());
    },

    /** How many connections this process holds — for tests and for a health endpoint. */
    get connectionCount(): number {
      return byToken.size;
    },

    /** How many topics this process holds a subscription for — for tests and for a health endpoint. */
    get topicCount(): number {
      return local.size;
    }
  };
};
