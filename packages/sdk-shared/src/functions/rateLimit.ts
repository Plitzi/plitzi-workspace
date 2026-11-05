/** How much of something is allowed: `most` in every `perSeconds`, for each caller or for everyone together. */
export type RateLimit = {
  most: number;
  perSeconds: number;
  per?: 'caller' | 'everyone';
  /**
   * Over the limit, the call is refused with these words — the step's error, on the page — rather than answered
   * `allowed: false` for the code to check: `ctx.rateLimit('make', { most: 5, perSeconds: 600, refuse: 'Wait ten minutes' })`.
   */
  refuse?: string;
};

/** Where a limit stands after counting one more: whether that one was within it, and how many are left. */
export type RateCount = { allowed: boolean; count: number; remaining: number };
