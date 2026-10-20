/* eslint-disable quotes -- the rows quote code, which reads best in the other quotes */
import type { AuthoringCodeEntry } from './entry';

/** Server actions and realtime channels. */
export const SERVER_CODES = {
  'action-without-entry': {
    kind: 'refused',
    means: 'an action with no way in, so nothing can start it',
    fix: "a `trigger` — `{ type: 'call', access }`, or `render`, `webhook`, `custom`, `schedule`"
  },
  'action-without-steps': {
    kind: 'refused',
    means: 'an action with no steps',
    fix: 'the steps it runs'
  },
  'action-step-params': {
    kind: 'refused',
    means: 'a step with no params in an action whose ways in declare different inputs',
    fix: "the step's params"
  },

  // Realtime channels.
  'channel-declaration': {
    kind: 'refused',
    means: 'a channel whose pattern or access the server cannot read',
    fix: "what the message says: `{ access: { mode: 'public' } }`, a pattern like `room:{id}`"
  },
  'channel-topic': {
    kind: 'refused',
    means: 'a `channel` element with no topic',
    fix: 'a topic a channel of the space covers'
  },
  'channel-grant': {
    kind: 'refused',
    means: 'a topic of a private channel opened with no grant to it',
    fix: 'the grant the message names, or a public channel'
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
