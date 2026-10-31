import type { AuthoringCodeEntry } from './entry';

/** The space's own tests, read as the rest of the space is: one that cannot be read is said where all is. */
export const TEST_CODES = {
  'test-unreadable': {
    kind: 'warned',
    means:
      'a test of the space — an element check or a flow — that cannot be read as it is written: a page no page of the space answers, an element it no longer has, a relation that is none. A snapshot and a publish wait for it',
    fix: 'the test as the message says — or the space back to what the test expects'
  },
  'test-account-role-gone': {
    kind: 'warned',
    means:
      'a test account holds a visitor role the space does not declare in `settings.visitorRoles` — removed since, or never there: a journey plays it without that role, and one that needed what it gave fails',
    fix: 'one of the space’s roles for the account — or the role declared again'
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
