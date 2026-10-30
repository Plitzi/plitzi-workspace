import type { AuthoringCodeEntry } from './entry';

/** The space's own tests, read as the rest of the space is: one that cannot be read is said where all is. */
export const TEST_CODES = {
  'test-unreadable': {
    kind: 'warned',
    means:
      'a test of the space — an element check or a flow — that cannot be read as it is written: a page no page of the space answers, an element it no longer has, a relation that is none. A snapshot and a publish wait for it',
    fix: 'the test as the message says — or the space back to what the test expects'
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
