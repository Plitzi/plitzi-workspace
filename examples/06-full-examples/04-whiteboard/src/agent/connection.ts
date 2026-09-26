/**
 * An agent's line to a board's channels: the same `/_realtime` socket a page opens, spoken from Node.
 *
 * The agent is a collaborator like any other because it connects like any other — it announces itself on the room
 * (`$presence`), answers a newcomer's `$join`, repeats itself every twenty seconds so it is not taken for gone, and
 * hears everything the pages hear. Nothing on the server knows it is not a browser.
 */

/** A message on a topic — `mine` when this connection sent it, which it hears like everyone else. */
export type Heard = { topic: string; type: string; from: string; data: unknown; mine: boolean };

/** How often a member says it is still here — as a page does. */
const HEARTBEAT_MS = 20_000;

/** How long a publish waits for the server's answer. */
const ACK_MS = 5000;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export type Connection = {
  /** This connection's name on the channels: the `from` of what it says. */
  readonly me: string;
  /** The socket closed — the server restarted, the network dropped: a new connection is needed. */
  readonly closed: boolean;
  publish: (topic: string, type: string, data: unknown) => Promise<boolean>;
  /** What this agent announces about itself on a presence topic — and keeps announcing. */
  announce: (topic: string, state: unknown) => void;
  close: () => void;
};

/**
 * Opens the socket for `topics` on `origin`, and answers once the server said it is ready. `onMessage` hears every
 * message on them — this connection's own too, which the caller tells apart by `me`.
 */
export const connect = (origin: string, topics: string[], onMessage: (heard: Heard) => void): Promise<Connection> =>
  new Promise((resolve, reject) => {
    const url = new URL(`/_realtime?topics=${encodeURIComponent(topics.join(','))}`, origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(url);
    const acks = new Map<number, (ok: boolean) => void>();
    const presence = new Map<string, unknown>();
    let next = 1;
    let me = '';
    let closed = false;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    const send = (topic: string, type: string, data: unknown): Promise<boolean> =>
      new Promise(done => {
        if (socket.readyState !== WebSocket.OPEN) {
          done(false);

          return;
        }

        const id = next;
        next += 1;
        const timeout = setTimeout(() => {
          acks.delete(id);
          done(false);
        }, ACK_MS);
        acks.set(id, ok => {
          clearTimeout(timeout);
          done(ok);
        });
        socket.send(JSON.stringify({ id, topic, type, data }));
      });

    const sayWhoIAm = (): void => {
      presence.forEach((state, topic) => void send(topic, '$presence', state));
    };

    socket.addEventListener('message', event => {
      let frame: unknown;
      try {
        frame = JSON.parse(String(event.data));
      } catch {
        return;
      }

      if (!isRecord(frame)) {
        return;
      }

      const { data } = frame;
      if (frame.event === 'ready' && isRecord(data) && typeof data.connection === 'string') {
        me = data.connection;
        heartbeat = setInterval(sayWhoIAm, HEARTBEAT_MS);
        resolve({
          get me() {
            return me;
          },
          get closed() {
            return closed;
          },
          publish: send,
          announce: (topic, state) => {
            presence.set(topic, state);
            void send(topic, '$presence', state);
          },
          close: () => {
            clearInterval(heartbeat);
            socket.close();
          }
        });

        return;
      }

      if (frame.event === 'ack' && isRecord(data) && typeof data.id === 'number') {
        acks.get(data.id)?.(data.ok === true);
        acks.delete(data.id);

        return;
      }

      if (
        frame.event === 'message' &&
        isRecord(data) &&
        typeof data.topic === 'string' &&
        typeof data.type === 'string'
      ) {
        // Somebody arrived: everyone says who they are, so the newcomer sees them at once.
        if (data.type === '$join' && presence.has(data.topic)) {
          void send(data.topic, '$presence', presence.get(data.topic));
        }

        const from = String(data.from ?? '');
        onMessage({ topic: data.topic, type: data.type, from, data: data.data, mine: from === me });
      }
    });

    socket.addEventListener('close', () => {
      closed = true;
      clearInterval(heartbeat);
      if (!me) {
        reject(
          new Error(`The board's channels would not open at ${origin} — is the board locked, or the server down?`)
        );
      }
    });
    socket.addEventListener('error', () => undefined);
  });
