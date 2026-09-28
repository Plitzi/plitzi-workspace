import { defineAction } from '@plitzi/sdk-authoring';

import type { ActionLookups } from '@plitzi/sdk-server/actions';

/**
 * The page's two server actions — documents, like any space's — and each one step: a task of the runtime's own. The
 * flow names `visits.read` or `visits.count`; which process runs it is the server's business.
 */

/** How many visits there have been, built into the page as it renders. */
export const visits = defineAction({
  id: 'visits',
  name: 'Visits',
  description: 'How many visits there have been.',
  trigger: { type: 'render', access: 'public' },
  steps: [{ id: 'read', task: 'visits.read' }],
  output: '{{ read }}'
});

/** One more visit, counted when the button is pressed. */
export const visit = defineAction({
  id: 'visit',
  name: 'Count a visit',
  description: 'One more visit, and how many there have been.',
  trigger: { type: 'call', access: 'public' },
  steps: [{ id: 'count', task: 'visits.count' }],
  output: '{{ count }}'
});

const actions = [visits, visit];

export const lookups: ActionLookups = {
  getAction: (_spaceId, actionId) => Promise.resolve(actions.find(entry => entry.id === actionId)),
  listActions: () => Promise.resolve(actions)
};
