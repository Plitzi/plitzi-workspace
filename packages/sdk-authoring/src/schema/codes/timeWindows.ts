import type { AuthoringCodeEntry } from './entry';

/** Time windows (`timeWindow`). */
export const TIME_WINDOW_CODES = {
  'time-window-bound': {
    kind: 'refused',
    means: "a `timeWindow`'s `startsAt` or `endsAt` that is not an instant with its offset — never read, so no bound",
    fix: "`startsAt: '2026-12-01T09:00:00Z'` (or `+01:00`); empty for no bound"
  },
  'time-window-empty': {
    kind: 'warned',
    means: 'a `timeWindow` that ends before it starts — it never shows what it holds',
    fix: '`endsAt` after `startsAt`'
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
