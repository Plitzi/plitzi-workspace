import { defineAction } from '@plitzi/sdk-authoring';

import type { ActionLookups } from '@plitzi/sdk-actions';

/**
 * The page's one action, a document like any space's: one more press, counted in the space's kv. The page names it;
 * which process runs it — here, the worker — is the deployment's business.
 */
export const press = defineAction({
  id: 'press',
  name: 'Press',
  description: 'One more press, and how many there have been.',
  trigger: { type: 'call', access: 'public' },
  steps: [{ id: 'count', task: 'kv.increment', params: { key: 'presses', amount: '1' } }],
  output: '{"presses": {{ count.value }}}'
});

/** A real deployment reads these from its own store; the worker is the one process that asks. */
export const lookups: ActionLookups = {
  getAction: (_spaceId, actionId) => Promise.resolve(actionId === press.id ? press : undefined)
};
