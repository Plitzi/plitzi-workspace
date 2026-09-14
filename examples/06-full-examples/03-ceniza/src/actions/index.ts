import { AVAILABILITY_ACTION, availabilityAction } from './availability';
import { BOOKING_ACTION, bookingAction } from './booking';
import { HOURS_ACTION, hoursAction } from './hours';
import { JOURNAL_ACTION, journalAction } from './journal';
import { NEWSLETTER_ACTION, newsletterAction } from './newsletter';

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

/** Held in the project rather than in a database, so every revision of the space runs the same documents. */
export const lookups: ActionLookups = {
  getAction: (_spaceId, actionId) => Promise.resolve(actions.find(entry => entry.id === actionId)),
  listActions: () => Promise.resolve(actions)
};

export { AVAILABILITY_ACTION, BOOKING_ACTION, HOURS_ACTION, JOURNAL_ACTION, NEWSLETTER_ACTION };
export { slotId } from './rules';
