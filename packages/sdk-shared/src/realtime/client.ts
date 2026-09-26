import type { RealtimeMessage } from '../types/RealtimeTypes';

export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'closed';

type MessageListener = (message: RealtimeMessage) => void;
type StatusListener = (status: RealtimeStatus) => void;

export type RealtimeClient = {
  /** Listens to a topic; the page's one connection is reopened to include it. Returns what stops listening. */
  subscribe: (topic: string, listener: MessageListener) => () => void;
  /** Sends on a topic this page listens to. `false` when the server refused it or there is no connection. */
  publish: (topic: string, type: string, data: unknown) => Promise<boolean>;
  onStatus: (listener: StatusListener) => () => void;
  readonly status: RealtimeStatus;
  /** This page's name on its channels — the `from` of what it sends — once connected. */
  readonly me: string | undefined;
  /** Why the server would not open a topic, when it would not. */
  refusal: (topic: string) => string | undefined;
};

/** How long topic changes are gathered before the connection is reopened: a page mounting three channels opens once. */
const GATHER_MS = 30;
const BACKOFF_MS = [500, 1000, 2000, 5000, 10_000];
/** How long a publish waits for a connection that is still opening. */
const PUBLISH_WAIT_MS = 5000;

type Ready = { connection: string; token: string; refused: { topic: string; reason: string }[] };

const isReady = (value: unknown): value is Ready =>
  typeof value === 'object' &&
  value !== null &&
  'connection' in value &&
  typeof value.connection === 'string' &&
  'token' in value &&
  typeof value.token === 'string';

const isMessage = (value: unknown): value is RealtimeMessage =>
  typeof value === 'object' &&
  value !== null &&
  'topic' in value &&
  typeof value.topic === 'string' &&
  'type' in value &&
  typeof value.type === 'string';

/** One `event:`/`data:` block of a Server-Sent Events body. */
const parseEvent = (block: string): { event: string; data: unknown } | undefined => {
  let event = 'message';
  const data: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event: ')) {
      event = line.slice(7);
    } else if (line.startsWith('data: ')) {
      data.push(line.slice(6));
    }
  }

  if (!data.length) {
    return undefined;
  }

  try {
    return { event, data: JSON.parse(data.join('\n')) as unknown };
  } catch {
    return undefined;
  }
};

/**
 * A page's realtime connection: every topic it listens to over ONE stream, published to over plain requests.
 *
 * Read with `fetch` rather than `EventSource`: an `EventSource` reconnects on its own, with the same topics, to a
 * server that may have just refused them — and cannot send the credentials a same-site request carries by default.
 * Reconnecting is this client's decision: after a dropped connection, with a growing wait; never after a refusal.
 */
export const createRealtimeClient = (endpoint: string, fetchImpl: typeof fetch = fetch): RealtimeClient => {
  const listeners = new Map<string, Set<MessageListener>>();
  const statusListeners = new Set<StatusListener>();
  let status: RealtimeStatus = 'idle';
  let current: { controller: AbortController; token?: string; me?: string; topics: string } | undefined;
  let refusals = new Map<string, string>();
  let gather: ReturnType<typeof setTimeout> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;

  const setStatus = (next: RealtimeStatus): void => {
    status = next;
    statusListeners.forEach(listener => listener(next));
  };

  const topicsKey = (): string => [...listeners.keys()].sort().join(',');

  const deliver = (message: RealtimeMessage): void => {
    listeners.get(message.topic)?.forEach(listener => listener(message));
  };

  const read = async (response: Response, connection: NonNullable<typeof current>): Promise<void> => {
    const reader = response.body?.getReader();
    if (!reader) {
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      let end = buffer.indexOf('\n\n');
      while (end !== -1) {
        const parsed = parseEvent(buffer.slice(0, end));
        buffer = buffer.slice(end + 2);
        end = buffer.indexOf('\n\n');
        if (parsed?.event === 'ready' && isReady(parsed.data)) {
          connection.token = parsed.data.token;
          connection.me = parsed.data.connection;
          refusals = new Map(parsed.data.refused.map(entry => [entry.topic, entry.reason]));
          attempt = 0;
          setStatus('open');
        } else if (parsed?.event === 'message' && isMessage(parsed.data)) {
          deliver(parsed.data);
        }
      }
    }
  };

  const open = (): void => {
    current?.controller.abort();
    current = undefined;
    const topics = topicsKey();
    if (!topics) {
      setStatus('idle');

      return;
    }

    const connection = { controller: new AbortController(), topics };
    current = connection;
    setStatus('connecting');
    void fetchImpl(`${endpoint}?topics=${encodeURIComponent(topics)}`, {
      headers: { accept: 'text/event-stream' },
      credentials: 'same-origin',
      signal: connection.controller.signal
    })
      .then(async response => {
        if (!response.ok) {
          // Refused — undeclared topics, no access. Asking again with the same topics would be refused again.
          refusals = new Map(topics.split(',').map(topic => [topic, `http_${response.status}`]));
          setStatus('closed');

          return;
        }

        await read(response, connection);
        throw new Error('The realtime stream ended');
      })
      .catch(() => {
        if (connection.controller.signal.aborted || current !== connection) {
          return;
        }

        setStatus('connecting');
        const wait = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
        attempt += 1;
        retry = setTimeout(open, wait);
      });
  };

  const reopenSoon = (): void => {
    clearTimeout(gather);
    clearTimeout(retry);
    gather = setTimeout(() => {
      if (current?.topics !== topicsKey()) {
        open();
      }
    }, GATHER_MS);
  };

  /**
   * Open AND listening to `topic`. A connection that is open on the topics of a moment ago — a page that just started
   * listening to one more, the next page after a navigation — would have its publish refused as not subscribed, so
   * a publish waits for the connection that includes it.
   */
  const covers = (topic: string): boolean => status === 'open' && current?.topics.split(',').includes(topic) === true;

  const whenOpen = (topic: string): Promise<boolean> =>
    covers(topic)
      ? Promise.resolve(true)
      : new Promise(resolve => {
          const timer = setTimeout(() => {
            stop();
            resolve(false);
          }, PUBLISH_WAIT_MS);
          const stop = client.onStatus(next => {
            if (next === 'closed' || covers(topic)) {
              clearTimeout(timer);
              stop();
              resolve(next !== 'closed');
            }
          });
        });

  const client: RealtimeClient = {
    subscribe: (topic, listener) => {
      const set = listeners.get(topic) ?? new Set<MessageListener>();
      set.add(listener);
      listeners.set(topic, set);
      reopenSoon();

      return () => {
        set.delete(listener);
        if (!set.size) {
          listeners.delete(topic);
          reopenSoon();
        }
      };
    },
    publish: async (topic, type, data) => {
      if (!(await whenOpen(topic)) || !current?.token) {
        return false;
      }

      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ token: current.token, topic, type, data })
      }).catch(() => undefined);
      if (response?.status === 401) {
        // The server no longer knows this connection — it restarted, or dropped it. A new one gets a new secret.
        open();
      }

      return response?.ok ?? false;
    },
    onStatus: listener => {
      statusListeners.add(listener);

      return () => statusListeners.delete(listener);
    },
    get status() {
      return status;
    },
    get me() {
      return current?.me;
    },
    refusal: topic => refusals.get(topic)
  };

  return client;
};

const clients = new Map<string, RealtimeClient>();

/** The page's client for an endpoint: one connection, however many elements and plugins listen. */
export const realtimeClientFor = (endpoint: string): RealtimeClient => {
  const existing = clients.get(endpoint);
  if (existing) {
    return existing;
  }

  const client = createRealtimeClient(endpoint);
  clients.set(endpoint, client);

  return client;
};
