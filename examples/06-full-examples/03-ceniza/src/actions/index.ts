import { AVAILABILITY_ACTION, availabilityAction } from './availability';
import { BOOKING_ACTION, bookingAction } from './booking';
import { HOURS_ACTION, hoursAction } from './hours';
import { JOURNAL_ACTION, journalAction } from './journal';
import { NEWSLETTER_ACTION, newsletterAction } from './newsletter';
import { SMTP_CREDENTIAL } from './rules';
import { restaurant } from '../content';

import type { ActionLookups } from '@plitzi/sdk-server/actions';

/**
 * The server actions this space runs.
 *
 * Documents, every one of them — the same the builder would author — and built only from tasks `sdk-server` ships:
 * `kv` to count and keep, `transform` to decide, `email.send` to confirm. None needs code of this project's own on the
 * server that runs it, which is what lets these documents travel with the space: seeded into a hosted Plitzi, they run
 * there exactly as they run here.
 *
 * The page never learns more than an action's id: what it may send is declared on the trigger (anything else is dropped
 * before a step runs), and what it gets back is exactly what `output` names.
 */
export const actions = [availabilityAction, bookingAction, newsletterAction, journalAction, hoursAction];

/**
 * The space's one credential: the SMTP server the confirmation and the welcome go through.
 *
 * A Mailpit on this machine (`docker run -p 1025:1025 -p 8025:8025 axllent/mailpit`), so the mail really is sent and
 * lands at http://localhost:8025 rather than in anybody's inbox. A real deployment keeps its credentials wherever it
 * keeps its secrets, and the actions do not change.
 */
const credentials: Record<string, Record<string, string>> = {
  [SMTP_CREDENTIAL]: {
    host: '127.0.0.1',
    port: '1025',
    security: 'none',
    username: '',
    password: '',
    fromEmail: restaurant.email,
    fromName: restaurant.name
  }
};

/** Held in the project rather than in a database, so every revision of the space runs the same documents. */
export const lookups: ActionLookups = {
  getAction: (_spaceId, actionId) => Promise.resolve(actions.find(entry => entry.id === actionId)),
  listActions: () => Promise.resolve(actions),
  getCredential: (_spaceId, identifier) => Promise.resolve(credentials[identifier])
};

export { AVAILABILITY_ACTION, BOOKING_ACTION, HOURS_ACTION, JOURNAL_ACTION, NEWSLETTER_ACTION };
export { slotId } from './rules';
