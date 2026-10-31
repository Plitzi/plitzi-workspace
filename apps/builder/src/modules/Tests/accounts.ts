import type { E2eAccount, E2eTest } from '@plitzi/sdk-shared';

/**
 * The space's test accounts as the Tests area edits them (`tests.accounts`): who a journey plays as, signed in — declared
 * here alone, no account of the platform's.
 */

/** An account's id: letters, digits, `-` and `_`. */
const NAME = /^[A-Za-z0-9_-]+$/;

/** An account as its form holds it: the roles chosen from the space's own. */
export type AccountDraft = { id: string; email: string; roles: string[] };

export const draftOf = (account?: E2eAccount): AccountDraft => ({
  id: account?.id ?? '',
  email: account?.email ?? '',
  roles: account?.roles ?? []
});

/** The account a form holds, or what keeps it from being one — said where it is fixed. */
export const accountFrom = (
  draft: AccountDraft,
  /** The other accounts' ids: an id is one account's. */
  taken: readonly string[]
): E2eAccount | { problem: string } => {
  const id = draft.id.trim();
  if (!NAME.test(id)) {
    return { problem: 'Its id is letters, digits, - and _: editor, visitor-pro' };
  }

  if (taken.includes(id)) {
    return { problem: `"${id}" is another test account’s id` };
  }

  const email = draft.email.trim();

  return { id, ...(email ? { email } : {}), ...(draft.roles.length > 0 ? { roles: draft.roles } : {}) };
};

/** The accounts with this one in its place — or last, when it is new. */
export const withAccount = (accounts: readonly E2eAccount[], account: E2eAccount): E2eAccount[] =>
  accounts.some(each => each.id === account.id)
    ? accounts.map(each => (each.id === account.id ? account : each))
    : [...accounts, account];

/** The journeys that play as an account, by title: what keeps it from being removed. */
export const playedAs = (journeys: readonly E2eTest[], id: string): string[] =>
  journeys.filter(journey => journey.as === id).map(journey => journey.title || journey.id);
