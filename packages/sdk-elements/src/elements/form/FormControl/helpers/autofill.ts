/**
 * What a field holds, as a browser and a password manager read `autocomplete` (WHATWG autofill tokens) — the ones a
 * sign-in, a sign-up and a contact form use. A password field said `off` for every space, so no password manager
 * filled a sign-in or offered to save a new password.
 */
export const AUTOFILL_FIELDS = [
  'username',
  'current-password',
  'new-password',
  'one-time-code',
  'email',
  'name',
  'given-name',
  'family-name',
  'organization',
  'tel',
  'street-address',
  'postal-code',
  'country',
  'url'
] as const;

export type AutofillField = (typeof AUTOFILL_FIELDS)[number];

/**
 * The `autocomplete` an input is drawn with: `true` leaves it to the browser — the account's current password, on a
 * password field — `false` asks it not to fill, and a token names what the field holds. In the builder's canvas a field
 * is never filled: what is being designed is not a sign-in.
 */
export const autocompleteOf = (autoComplete: boolean | AutofillField, subType: string, live: boolean): string => {
  if (!live || autoComplete === false) {
    return 'off';
  }

  if (autoComplete !== true) {
    return autoComplete;
  }

  return subType === 'password' ? 'current-password' : 'on';
};
