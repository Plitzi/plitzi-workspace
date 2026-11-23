import type { AuthoringCodeEntry } from './entry';

/** The elements of who is visiting (`account`, `signInForm`). */
export const USER_CODES = {
  'account-sign-in-unreachable': {
    kind: 'warned',
    means:
      'an `account` with no `signInHref` in a space that signs in with its own provider (`userProvider: "basic"`) — a sign-in there needs a form, so its "Sign in" leads nowhere',
    fix: "`signInHref: '/sign-in'`, the page with the space's `signInForm`"
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
