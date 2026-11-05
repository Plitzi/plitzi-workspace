/**
 * When a session was last used, to the resolution a device list needs.
 *
 * "Active 3 minutes ago" against "active last March" is what tells somebody which of their devices is the one they do
 * not recognise — and the time a session was CREATED says neither: a laptop signed in a month ago and used this morning
 * reads as a month-old session. Recording every request would be a write per request on the hottest read in the
 * system, so a store records it at most once per this many seconds, on the lookup it already makes.
 */
export const SESSION_ACTIVITY_RESOLUTION_SECONDS = 300;

/** Whether a session last seen at `lastActiveAt` (unix seconds, absent when never) is due a new record at `now`. */
export const activityDue = (lastActiveAt: number | null | undefined, now: number): boolean =>
  lastActiveAt === null || lastActiveAt === undefined || now - lastActiveAt >= SESSION_ACTIVITY_RESOLUTION_SECONDS;
