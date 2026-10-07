import { createHash } from 'node:crypto';

/**
 * The same batch refused again — an agent going round in circles, which a model is not trusted to notice. Counted per
 * process, as a hint and never a lock: a call that lands on another worker only loses the hint.
 */

const WINDOW_MS = 10 * 60 * 1000;

const KEPT = 500;

const refused = new Map<string, { count: number; at: number }>();

/** One batch, by where it was sent and what it holds. */
export const batchKey = (scope: string, operations: unknown): string =>
  `${scope}:${createHash('sha256').update(JSON.stringify(operations)).digest('hex')}`;

/** How many times this batch was refused lately — before this one. */
export const timesRefused = (key: string, now = Date.now()): number => {
  const entry = refused.get(key);

  return entry && now - entry.at < WINDOW_MS ? entry.count : 0;
};

/** The batch was refused once more. */
export const noteRefused = (key: string, now = Date.now()): void => {
  refused.set(key, { count: timesRefused(key, now) + 1, at: now });
  if (refused.size > KEPT) {
    const oldest = refused.keys().next().value;
    if (oldest !== undefined) {
      refused.delete(oldest);
    }
  }
};

/** The batch went through: what was refused before no longer counts. */
export const forgetRefused = (key: string): void => {
  refused.delete(key);
};

export const AGAIN =
  'This batch was refused before, for these reasons. Sending it again will not change the answer: change what the ' +
  'errors name — plitzi_describe_operation { type } gives an operation’s fields, a hint its way out — or stop and ' +
  'ask the person what they meant.';

export const REPEATED = {
  error: 'REPEATED_BATCH',
  message: 'This exact batch was refused twice, and was not run again. Change what the errors named, or ask the person.'
};
