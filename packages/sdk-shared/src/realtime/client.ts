import type { RealtimeMessage, RealtimeTransport } from '../types/RealtimeTypes';

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
  /** How this page is connected right now: a socket, or a stream (also where a socket could not open). */
  readonly transport: RealtimeTransport;
  /** Why the server would not open a topic, when it would not. */
  refusal: (topic: string) => string | undefined;
};

export type RealtimeClientOptions = {
  /** What to connect with. `websocket` falls back to `sse` for good the first time a socket cannot open. */
  transport?: RealtimeTransport;
  fetchImpl?: typeof fetch;
  WebSocketImpl?: typeof WebSocket;
};

/** How long topic changes are gathered before the connection is reopened: a page mounting three channels opens once. */
const GATHER_MS = 30;
const BACKOFF_MS = [500, 1000, 2000, 5000, 10_000];
/** How long a publish waits for a connection that is still opening — and, on a socket, for its answer. */
const PUBLISH_WAIT_MS = 5000;

type Ready = { connection: string; token?: string; refused: { topic: string; reason: string }[] };

const isReady = (value: unknown): value is Ready =>
  typeof value === 'object' &&
  value !== null &&
  'connection' in value &&
  typeof value.connection === 'string' &&
  'refused' in value &&
  Array.isArray(value.refused);

const isMessage = (value: unknown): value is RealtimeMessage =>
  typeof value === 'object' &&
  value !== null &&
  'topic' in value &&
  typeof value.topic === 'string' &&
  'type' in value &&
  typeof value.type === 'string';

const isAck = (value: unknown): value is { id: number; ok: boolean } =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  typeof value.id === 'number' &&
  'ok' in value &&
  typeof value.ok === 'boolean';

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

/** One frame of a socket: the same `{ event, data }` the stream sends as an SSE block. */
const parseFrame = (frame: unknown): { event: string; data: unknown } | undefined => {
  try {
    const value: unknown = JSON.parse(String(frame));

    return typeof value === 'object' && value !== null && 'event' in value && typeof value.event === 'string'
      ? { event: value.event, data: 'data' in value ? value.data : undefined }
      : undefined;
  } catch {
    return undefined;
  }
};

/** The socket's address for an endpoint written as a path: the page's own host, `ws:` or `wss:` as the page is. */
const socketUrl = (endpoint: string, topics: string): string => {
  const url = new URL(`${endpoint}?topics=${encodeURIComponent(topics)}`, globalThis.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

  return url.href;
};

/** One connection, whichever transport carries it. */
type Connection = {
  topics: string;
  transport: RealtimeTransport;
  me?: string;
  close: () => void;
  publish: (topic: string, type: string, data: unknown) => Promise<boolean>;
};

/**
 * A page's realtime connection: every topic it listens to over ONE connection — a Server-Sent Events stream it
 * publishes to with requests, or a WebSocket that carries both.
 *
 * The stream is read with `fetch` rather than `EventSource`: an `EventSource` reconnects on its own, with the same
 * topics, to a server that may have just refused them. Reconnecting is this client's decision: after a dropped
 * connection, with a growing wait; never after a refusal.
 *
 * A socket that closes before it was ever ready is a socket that cannot open here — HTTP/2, a proxy that drops
 * upgrades, or a refusal, which a browser does not let a page read — so the client moves to the stream for good. The
 * stream says which it was.
 */
export const createRealtimeClient = (
  endpoint: string,
  { transport: preferred = 'sse', fetchImpl = fetch, WebSocketImpl = globalThis.WebSocket }: RealtimeClientOptions = {}
): RealtimeClient => {
  const listeners = new Map<string, Set<MessageListener>>();
  const statusListeners = new Set<StatusListener>();
  let status: RealtimeStatus = 'idle';
  let current: Connection | undefined;
  let refusals = new Map<string, string>();
  let gather: ReturnType<typeof setTimeout> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let socketsWork = preferred === 'websocket' && typeof WebSocketImpl === 'function';

  const setStatus = (next: RealtimeStatus): void => {
    status = next;
    statusListeners.forEach(listener => listener(next));
  };

  const topicsKey = (): string => [...listeners.keys()].sort().join(',');

  const deliver = (message: RealtimeMessage): void => {
    listeners.get(message.topic)?.forEach(listener => listener(message));
  };

  const onReady = (connection: Connection, ready: Ready): void => {
    connection.me = ready.connection;
    refusals = new Map(ready.refused.map(entry => [entry.topic, entry.reason]));
    attempt = 0;
    setStatus('open');
  };

  /** A connection that ended by itself: dropped, so try again — unless another one replaced it meanwhile. */
  const onDropped = (connection: Connection): void => {
    if (current !== connection) {
      return;
    }

    setStatus('connecting');
    const wait = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
    attempt += 1;
    retry = setTimeout(open, wait);
  };

  const openStream = (topics: string): Connection => {
    const controller = new AbortController();
    let token: string | undefined;
    const connection: Connection = {
      topics,
      transport: 'sse',
      close: () => controller.abort(),
      publish: async (topic, type, data) => {
        if (!token) {
          return false;
        }

        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ token, topic, type, data })
        }).catch(() => undefined);
        if (response?.status === 401 && current === connection) {
          // The server no longer knows this connection — it restarted, or dropped it. A new one gets a new secret.
          open();
        }

        return response?.ok ?? false;
      }
    };

    const read = async (response: Response): Promise<void> => {
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
            token = parsed.data.token;
            onReady(connection, parsed.data);
          } else if (parsed?.event === 'message' && isMessage(parsed.data)) {
            deliver(parsed.data);
          }
        }
      }
    };

    void fetchImpl(`${endpoint}?topics=${encodeURIComponent(topics)}`, {
      headers: { accept: 'text/event-stream' },
      credentials: 'same-origin',
      signal: controller.signal
    })
      .then(async response => {
        if (!response.ok) {
          // Refused — undeclared topics, no access. Asking again with the same topics would be refused again.
          refusals = new Map(topics.split(',').map(topic => [topic, `http_${response.status}`]));
          setStatus('closed');

          return;
        }

        await read(response);
        throw new Error('The realtime stream ended');
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          onDropped(connection);
        }
      });

    return connection;
  };

  const openSocket = (topics: string): Connection => {
    const socket = new WebSocketImpl(socketUrl(endpoint, topics));
    const acks = new Map<number, (ok: boolean) => void>();
    let nextId = 0;
    let ready = false;
    let closedByUs = false;
    const settleAll = (): void => {
      acks.forEach(settle => settle(false));
      acks.clear();
    };

    const connection: Connection = {
      topics,
      transport: 'websocket',
      close: () => {
        closedByUs = true;
        settleAll();
        socket.close();
      },
      publish: (topic, type, data) =>
        new Promise(resolve => {
          if (socket.readyState !== socket.OPEN) {
            resolve(false);

            return;
          }

          nextId += 1;
          const id = nextId;
          const timer = setTimeout(() => {
            acks.delete(id);
            resolve(false);
          }, PUBLISH_WAIT_MS);
          acks.set(id, ok => {
            clearTimeout(timer);
            resolve(ok);
          });
          socket.send(JSON.stringify({ id, topic, type, data }));
        })
    };

    socket.onmessage = event => {
      const parsed = parseFrame(event.data);
      if (parsed?.event === 'ready' && isReady(parsed.data)) {
        ready = true;
        onReady(connection, parsed.data);
      } else if (parsed?.event === 'message' && isMessage(parsed.data)) {
        deliver(parsed.data);
      } else if (parsed?.event === 'ack' && isAck(parsed.data)) {
        acks.get(parsed.data.id)?.(parsed.data.ok);
        acks.delete(parsed.data.id);
      }
    };

    socket.onclose = () => {
      settleAll();
      if (closedByUs || current !== connection) {
        return;
      }

      if (!ready) {
        // Never opened here: the stream from now on — it works wherever HTTP does, and says why if it was refused.
        socketsWork = false;
        open();

        return;
      }

      onDropped(connection);
    };

    return connection;
  };

  function open(): void {
    current?.close();
    current = undefined;
    const topics = topicsKey();
    if (!topics) {
      setStatus('idle');

      return;
    }

    setStatus('connecting');
    current = socketsWork ? openSocket(topics) : openStream(topics);
  }

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
      if (!(await whenOpen(topic)) || !current) {
        return false;
      }

      return current.publish(topic, type, data);
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
    get transport() {
      return current?.transport ?? (socketsWork ? 'websocket' : 'sse');
    },
    refusal: topic => refusals.get(topic)
  };

  return client;
};

const clients = new Map<string, RealtimeClient>();

/** The page's client for an endpoint: one connection, however many elements and plugins listen. */
export const realtimeClientFor = (endpoint: string, transport: RealtimeTransport = 'sse'): RealtimeClient => {
  const key = `${transport} ${endpoint}`;
  const existing = clients.get(key);
  if (existing) {
    return existing;
  }

  const client = createRealtimeClient(endpoint, { transport });
  clients.set(key, client);

  return client;
};
