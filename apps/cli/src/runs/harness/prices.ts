/**
 * What a turn costs at the Claude API's list prices, in US dollars — the monitor's spend says it beside the tokens. A
 * run on a subscription pays none of it: it is what the same work costs on the API, to weigh one run against another.
 * Prices per million tokens as published on 2026-10-06; cache writes at 1.25× the input for five minutes, 2× for an hour.
 * A model not listed has no price, and its spend is said in tokens alone — never a price guessed.
 */

interface Price {
  input: number;
  output: number;
  cacheRead: number;
  /** A prompt past this many tokens is charged at `beyond` instead (Haiku 5.5's long prompts). */
  upTo?: number;
  beyond?: Omit<Price, 'upTo' | 'beyond'>;
}

const PRICES: Record<string, Price> = {
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25 },
  'claude-fable-5': { input: 10, output: 50, cacheRead: 1 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-opus-4-7': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-opus-4-6': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-sonnet-4-6': { input: 3, output: 15, cacheRead: 0.3 },
  'claude-haiku-5-5': {
    input: 0.1,
    output: 0.5,
    cacheRead: 0.01,
    upTo: 100_000,
    beyond: { input: 0.5, output: 2.5, cacheRead: 0.05 }
  },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1 }
};

/**
 * A model's price by the id its harness wrote: a provider before it (`anthropic/…`), a context after it (`[1m]`) and a
 * snapshot's date (`-20251001`) name the same model.
 */
export const priceOf = (model: string | undefined): Price | undefined =>
  model === undefined
    ? undefined
    : PRICES[
        model
          .replace(/^[\w-]+\//, '')
          .replace(/\[[^\]]*\]$/, '')
          .replace(/-\d{8}$/, '')
      ];

export interface PricedTurn {
  input: number;
  cacheRead: number;
  /** Written to the cache, `cacheWriteLong` of it for an hour. */
  cacheWrite: number;
  cacheWriteLong: number;
  output: number;
}

/** One turn's cost in dollars. */
export const turnCost = (price: Price, turn: PricedTurn): number => {
  const prompt = turn.input + turn.cacheRead + turn.cacheWrite;
  const rate = price.upTo !== undefined && price.beyond && prompt > price.upTo ? price.beyond : price;
  const long = Math.min(turn.cacheWriteLong, turn.cacheWrite);

  return (
    (turn.input * rate.input +
      (turn.cacheWrite - long) * rate.input * 1.25 +
      long * rate.input * 2 +
      turn.cacheRead * rate.cacheRead +
      turn.output * rate.output) /
    1_000_000
  );
};
