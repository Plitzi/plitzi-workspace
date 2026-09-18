/**
 * How wide the header's dialogs open, as settings for `showModal`.
 *
 * The modal's own card stops at `max-w-lg`, which suits a confirmation and cramps anything else: a form with a
 * revision list, a domain and a credential needs room to read, and a code viewer needs room for a 120-column file.
 */
export const FORM_MODAL = { className: { card: 'w-[min(720px,94vw)] max-w-none' } };

export const WIDE_MODAL = { className: { card: 'w-[min(1180px,94vw)] max-w-none' } };
