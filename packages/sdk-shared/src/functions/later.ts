/** What a run asks to start later: one of the space's actions, in so many seconds, with its input — and a name. */
export type LaterRequest = {
  /** The action, by its identifier. It says it may be started this way with a `later` trigger. */
  action: string;
  /** Seconds from now, by the queue's clock — whole or not, from 0 to a month. */
  in: number;
  input?: Record<string, unknown>;
  /**
   * What it is known by in this space: setting another under the same key replaces the one still waiting — a turn's
   * timer moved on by a move — and `cancelLater(key)` drops it. The one already running is left be.
   */
  key?: string;
};

/** The job it became, and when it is due — epoch ms, by the queue's clock. */
export type LaterAnswer = { id: string; at: number };
