import type { E2eAccount, E2eTest } from '@plitzi/sdk-shared';

/**
 * The space's test accounts as the Tests area edits them (`tests.accounts`): who a journey plays as, signed in — declared
 * here alone, no account of the platform's.
 */

/** An account's id, and each of its roles and permissions: letters, digits, `-` and `_`. */
const NAME = /^[A-Za-z0-9_-]+$/;

/** An account as its form holds it: each list as a person types it, `editor, viewer`. */
export type AccountDraft = { id: string; email: string; roles: string; permissions: string };

/** Names as a person types them — `editor, viewer` or one a line — each once. */
export const namesOf = (text: string): string[] => [...new Set(text.split(/[\s,]+/).filter(Boolean))];

export const draftOf = (account?: E2eAccount): AccountDraft => ({
  id: account?.id ?? '',
  email: account?.email ?? '',
  roles: (account?.roles ?? []).join(', '),
  permissions: (account?.permissions ?? []).join(', ')
});

/** The account a form holds, or what keeps it from being one — said where it is fixed. */
export const accountFrom = (
  draft: AccountDraft,
  /** The other accounts' ids: an id is one account's. */
  taken: readonly string[]
): E2eAccount | { problem: string } => {
  const id = draft.id.trim();
  const roles = namesOf(draft.roles);
  const permissions = namesOf(draft.permissions);
  const wrong = [...roles, ...permissions].find(name => !NAME.test(name));
  if (!NAME.test(id)) {
    return { problem: 'Its id is letters, digits, - and _: editor, visitor-pro' };
  }

  if (taken.includes(id)) {
    return { problem: `"${id}" is another test account’s id` };
  }

  if (wrong !== undefined) {
    return { problem: `"${wrong}" is no role or permission’s name: letters, digits, - and _ (spaceEdit)` };
  }

  const email = draft.email.trim();

  return {
    id,
    ...(email ? { email } : {}),
    ...(roles.length > 0 ? { roles } : {}),
    ...(permissions.length > 0 ? { permissions } : {})
  };
};

/** The accounts with this one in its place — or last, when it is new. */
export const withAccount = (accounts: readonly E2eAccount[], account: E2eAccount): E2eAccount[] =>
  accounts.some(each => each.id === account.id)
    ? accounts.map(each => (each.id === account.id ? account : each))
    : [...accounts, account];

/** The journeys that play as an account, by title: what keeps it from being removed. */
export const playedAs = (journeys: readonly E2eTest[], id: string): string[] =>
  journeys.filter(journey => journey.as === id).map(journey => journey.title || journey.id);
