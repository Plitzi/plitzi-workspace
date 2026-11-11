/** The harnesses an agent is started in headless — each a command line of its own. */
export const HARNESSES = ['claude', 'codex', 'opencode'] as const;

export type Harness = (typeof HARNESSES)[number];

export const isHarness = (value: unknown): value is Harness =>
  typeof value === 'string' && (HARNESSES as readonly string[]).includes(value);
