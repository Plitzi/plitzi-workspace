import type { ActionAccess } from './ActionTypes';

/**
 * One kind of channel a space offers, declared under a topic PATTERN — `board:{id}` is every board, each its own topic.
 *
 * A topic no pattern of the space matches is refused, by the server and at authoring: a page cannot open a channel
 * nobody decided should exist.
 */
export type ChannelDeclaration = {
  /** Who may subscribe and publish — the access vocabulary actions use. */
  access: ActionAccess;
  /**
   * Who may send: `clients` (pages publish directly — cursors, reactions, what is cheap and ephemeral) or `server`
   * (only a flow's `realtime.publish` — what was validated and saved first). `clients` when absent.
   */
  publish?: 'clients' | 'server';
  /** Whether members announce themselves — who is here, and what they are pointing at. */
  presence?: boolean;
  /**
   * Whether a page needs a GRANT to open a topic of it: a token a flow's `realtime.grant` issued for that exact topic —
   * after checking a password, an invitation, an order's owner, whatever decides who is in. Without one the topic is
   * refused, however well its name is known; `access` still applies on top. For a private room, a customer's order,
   * a locked board.
   */
  grant?: boolean;
  /** The largest `data` a page may send, as JSON bytes. 4 KB when absent. */
  maxMessageBytes?: number;
  /** How many messages one connection may send a second. 30 when absent. */
  messagesPerSecond?: number;
};

export type ChannelDeclarations = Record<string, ChannelDeclaration>;

/** Who sent a message, as the SERVER knows them: a page cannot say it is someone else. */
export type RealtimeSender = {
  /** The connection, as the server named it — stable for as long as the page stays connected. */
  from: string;
  /** The signed-in visitor, when the connection carries a session. */
  user?: { id: number; name: string };
};

/**
 * A message, as every subscriber receives it.
 *
 * `type` and `data` are the sender's own vocabulary; everything else is stamped by the server. Types starting with
 * `$` are the channel's own: `$presence` (a member's state) and `$leave` (a member gone).
 */
export type RealtimeMessage = RealtimeSender & {
  topic: string;
  type: string;
  data: unknown;
  /** Server time, in milliseconds. */
  at: number;
  /**
   * The sender asked to hear it too ({@link RealtimePublishOptions}): it reaches the page that sent it as well, which
   * knows it for its own by `from` — its channel's `me`. Without it, a page never hears what it sent.
   */
  echo?: true;
};

/** What a page asks of a publish beyond the message itself. */
export type RealtimePublishOptions = {
  /**
   * Hear it too, once the server took it — a reaction, a chat line: what the sender shows the moment it sends. Off by
   * default, so what moves at the speed of a cursor is not drawn twice.
   */
  echo?: boolean;
};

/** What a page sends to publish: the secret its connection was given, and the message. */
export type RealtimePublishRequest = RealtimePublishOptions & { token: string; topic: string; type: string; data: unknown };

/**
 * How messages move between the processes and replicas of a deployment — transport only, strings in and out.
 *
 * Everything a channel DOES (who may, how big, how often, who sent it) is decided above it, once, for every
 * deployment. In memory for one self-hosted process and its workers; Redis, NATS or a cloud service for a fleet.
 */
export type PubSubAdapter = {
  /** Delivers `message` to every subscriber of `topic`, in this process and every other sharing the adapter. */
  publish: (topic: string, message: string) => Promise<void>;
  /** Calls `listener` for each message on `topic` until the returned function is called. */
  subscribe: (topic: string, listener: (message: string) => void) => Promise<() => Promise<void>>;
};

/**
 * How a page connects: a Server-Sent Events stream it publishes to with requests, or one WebSocket both ways.
 *
 * The stream works through anything that passes HTTP; the socket sends a message as a frame instead of a request,
 * which is what a page publishing a cursor twenty times a second wants. A page told to use the socket falls back to
 * the stream on its own where one cannot open (behind HTTP/2, a proxy that drops upgrades).
 */
export type RealtimeTransport = 'sse' | 'websocket';

/** A server's realtime channels. On by default; `false` turns the endpoint off. */
export type SSRRealtimeConfig =
  | {
      /** How messages reach the other processes and replicas. In memory (and across workers) when absent. */
      pubsub?: PubSubAdapter;
      /** Where pages connect. `/_realtime` when absent. */
      path?: string;
      /** How pages connect. `sse` when absent; both are always served, this is what pages are told to use. */
      transport?: RealtimeTransport;
      /**
       * Origins, besides the server's own, whose pages may open a WebSocket here (`https://app.example.com`). A
       * socket carries the visitor's cookies from any site, so every other origin is refused.
       */
      allowedOrigins?: string[];
    }
  | false;
