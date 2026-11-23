import type { AuthoringCodeEntry } from './entry';

/** Countdowns (`countdown`). */
export const COUNTDOWN_CODES = {
  'countdown-to': {
    kind: 'refused',
    means: "a `countdown`'s `to` that is not an instant with its offset — never read, so it counts to nothing",
    fix: "`to: '2026-12-01T09:00:00Z'` (or `+01:00`); empty inside a `timeWindow` to count to its `endsAt`"
  },
  'countdown-without-end': {
    kind: 'warned',
    means: 'a `countdown` with no `to` and no `timeWindow` around it with an `endsAt` — it shows zeros',
    fix: "`to: '2026-12-01T09:00:00Z'`, or the countdown inside the `timeWindow` whose end it counts to"
  },
  'countdown-units': {
    kind: 'warned',
    means: 'a `countdown` whose `smallest` unit is larger than its `largest` — it says the `largest` alone',
    fix: "`largest` the larger: `largest: 'days', smallest: 'minutes'`"
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
