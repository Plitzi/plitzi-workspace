import { defineAction } from '@plitzi/sdk-authoring';

import type { ActionLookups } from '@plitzi/sdk-server/actions';
import type { ActionEntry } from '@plitzi/sdk-shared';

/**
 * One action, reachable ONLY by a way in this deployment mounted itself.
 *
 * `custom` is a trigger step like any other: it declares who may start a run this way and what they may send, and
 * `name` is what the deployment mounts it under. Everything the built-in triggers are checked against — the step
 * being switched on, the access rule, the input contract, the lineage — is checked for this one too, because all
 * of it lives in the runner rather than in an endpoint.
 *
 * `access: 'public'` here says only that there is no VISITOR to authorize: a queue message is not a session. What
 * may put a message on the queue is the deployment's own business, upstream of this.
 */
export const settlePayout: ActionEntry = defineAction({
  id: 'settle-payout',
  name: 'Settle payout',
  description: 'Runs once per queued payout, from the deployment\u2019s own consumer.',
  trigger: {
    type: 'custom',
    name: 'queue',
    access: 'public',
    input: {
      payoutId: { type: 'text', required: true, label: 'Payout id' },
      amount: { type: 'number', required: true, label: 'Amount' }
    }
  },
  // Anything a message carries that the contract did not declare was dropped before this ran, which is what makes
  // interpolating `{{ input.* }}` into a step's params safe.
  steps: [{ id: 'total', task: 'kv.increment', params: { key: 'payouts:settled', amount: '{{input.amount}}' } }],
  output: '{"payoutId": "{{input.payoutId}}", "settledTotal": {{ total.value }}}'
});

/** A real deployment reads these from its own store; the shape is the same either way. */
export const lookups: ActionLookups = {
  getAction: (_spaceId: number, actionId: string) =>
    Promise.resolve(actionId === settlePayout.id ? settlePayout : undefined)
};
