/**
 * The pause between two steps of a play, in seconds, until the person sets their own: long enough to see each one work
 * on the page, short enough not to wait for it.
 */
export const STEP_DELAY_S = 0.25;

/** A pause asked for as the person wrote it: a number of seconds, none below 0 — anything else is the default. */
export const stepDelayOf = (seconds: unknown): number =>
  typeof seconds === 'number' && Number.isFinite(seconds) ? Math.max(0, seconds) : STEP_DELAY_S;

/** The pause before a step — the first is played at once — read as the play reaches it, so a change applies mid-play. */
export const pauseBefore = (delay: { current: number }, index: number): Promise<void> =>
  index > 0 && delay.current > 0
    ? new Promise(resolve => setTimeout(resolve, delay.current * 1000))
    : Promise.resolve();
