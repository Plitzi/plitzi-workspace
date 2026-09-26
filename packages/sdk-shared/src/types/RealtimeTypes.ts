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
};

/** What a page sends to publish: the secret its connection was given, and the message. */
export type RealtimePublishRequest = { token: string; topic: string; type: string; data: unknown };

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

/** A server's realtime channels. On by default; `false` turns the endpoint off. */
export type SSRRealtimeConfig =
  | {
      /** How messages reach the other processes and replicas. In memory (and across workers) when absent. */
      pubsub?: PubSubAdapter;
      /** Where pages connect. `/_realtime` when absent. */
      path?: string;
    }
  | false;
