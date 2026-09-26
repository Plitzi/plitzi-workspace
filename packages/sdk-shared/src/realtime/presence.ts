import { JOIN_TYPE, LEAVE_TYPE, PRESENCE_TYPE } from './topics';

import type { RealtimeClient } from './client';
import type { RealtimeMessage, RealtimeSender } from '../types/RealtimeTypes';

/** One member of a channel: who they are to the server, and what they announced. */
export type RealtimeMember = RealtimeSender & {
  /** What the member announced — a name, a colour, a cursor. */
  state: unknown;
  /** Whether this member is this page. */
  me: boolean;
};

/** How often a member says it is still here. */
const HEARTBEAT_MS = 20_000;
/** How long a member who has said nothing is kept: three heartbeats, less a little. */
const EXPIRE_MS = 65_000;

export type PresenceTracker = {
  /** Announces this page's state — and keeps announcing it, so it is not taken for gone. */
  set: (state: unknown) => void;
  members: () => RealtimeMember[];
  stop: () => void;
};

type Listeners = { onChange: (members: RealtimeMember[]) => void; onMessage?: (message: RealtimeMessage) => void };

type SharedPresence = {
  members: () => RealtimeMember[];
  set: (state: unknown) => void;
  listeners: Set<Listeners>;
  teardown: () => void;
};

/**
 * A page is ONE member of a topic, however many of its components listen to it — they share its connection, so they
 * share its name. What each of them sees is kept once per client and topic: a component that starts listening after
 * the page joined never hears the `$join` that made everyone announce themselves, and would otherwise know nobody
 * until the next heartbeat.
 */
const registry = new WeakMap<RealtimeClient, Map<string, SharedPresence>>();

const createShared = (client: RealtimeClient, topic: string, release: () => void): SharedPresence => {
  const others = new Map<string, { member: RealtimeMember; heardAt: number }>();
  const listeners = new Set<Listeners>();
  let own: unknown;
  let announced = false;

  const members = (): RealtimeMember[] => [
    ...(announced && client.me ? [{ from: client.me, state: own, me: true }] : []),
    ...[...others.values()].map(entry => entry.member)
  ];
  const changed = (): void => {
    const current = members();
    listeners.forEach(listener => listener.onChange(current));
  };

  const announce = (): void => {
    if (!announced) {
      return;
    }

    void client.publish(topic, PRESENCE_TYPE, own);
  };

  const stopListening = client.subscribe(topic, message => {
    if (message.from === client.me) {
      return;
    }

    if (message.type === PRESENCE_TYPE) {
      others.set(message.from, {
        member: { from: message.from, ...(message.user ? { user: message.user } : {}), state: message.data, me: false },
        heardAt: Date.now()
      });
      changed();
    } else if (message.type === LEAVE_TYPE) {
      if (others.delete(message.from)) {
        changed();
      }
    } else if (message.type === JOIN_TYPE) {
      announce();
    }

    listeners.forEach(listener => listener.onMessage?.(message));
  });

  // A reconnect is a new name on the channel: say who this page is again, under it.
  const stopStatus = client.onStatus(status => {
    if (status === 'open') {
      announce();
      changed();
    }
  });

  const heartbeat = setInterval(() => {
    announce();
    const now = Date.now();
    let expired = false;
    for (const [from, entry] of others) {
      if (now - entry.heardAt > EXPIRE_MS) {
        others.delete(from);
        expired = true;
      }
    }

    if (expired) {
      changed();
    }
  }, HEARTBEAT_MS);

  return {
    members,
    set: state => {
      own = state;
      announced = true;
      announce();
      changed();
    },
    listeners,
    teardown: () => {
      clearInterval(heartbeat);
      stopStatus();
      stopListening();
      release();
    }
  };
};

/**
 * Who is on a topic, kept from what the members say — nothing is stored anywhere.
 *
 * A member announces itself (`$presence`) when it sets its state, when somebody new arrives (`$join`) and every
 * twenty seconds; the server says `$leave` when its connection closes. A member heard from in none of those ways for
 * a minute is gone, which is what heals a leave that was lost.
 *
 * Every tracker of one topic on one client is a view of the same member: `set` from any of them is the page's state,
 * and a tracker started late begins with everyone already known.
 */
export const trackPresence = (
  client: RealtimeClient,
  topic: string,
  onChange: (members: RealtimeMember[]) => void,
  onMessage?: (message: RealtimeMessage) => void
): PresenceTracker => {
  const topics = registry.get(client) ?? new Map<string, SharedPresence>();
  registry.set(client, topics);
  const shared = topics.get(topic) ?? createShared(client, topic, () => topics.delete(topic));
  topics.set(topic, shared);

  const listener: Listeners = { onChange, ...(onMessage ? { onMessage } : {}) };
  shared.listeners.add(listener);
  const known = shared.members();
  if (known.length) {
    onChange(known);
  }

  return {
    set: shared.set,
    members: shared.members,
    stop: () => {
      if (shared.listeners.delete(listener) && !shared.listeners.size) {
        shared.teardown();
      }
    }
  };
};
