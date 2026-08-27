import { defineAction } from '@plitzi/sdk-authoring';

import type { ActionLookups } from '@plitzi/sdk-server/actions';
import type { ActionEntry, SpaceRevision } from '@plitzi/sdk-shared';

/**
 * Where this deployment keeps its actions, and what it answers when the server asks for one.
 *
 * An action is a DOCUMENT, not code: the same shape the builder authors and the runner executes. A real deployment
 * reads these rows from its database; here they are two objects, because the shape is the same either way and the
 * wiring is the part worth reading.
 */

/**
 * The same action, priced two ways.
 *
 * `ratePerKg` is what somebody edited after the space was published, and `label` is how you can tell the two
 * apart from outside — because everything else about them is identical. Publishing copied the flow as it read at
 * the time, so the published site keeps quoting the old rate until it is published again.
 */
const shippingQuote = (ratePerKg: number, label: string): ActionEntry =>
  defineAction({
    id: 'shipping-quote',
    name: 'Shipping quote',
    description: 'Prices a parcel for the visitor filling in the form.',
    /**
     * The way in, and everything about it: what starts the run, who may start it, what they may send — and, in
     * `enabled`, whether it is open at all. There is no second switch beside the flow: an action is on when a way
     * into it is.
     *
     * It becomes a trigger STEP, exactly as an element's `onClick` is — which is why a second way in is a second
     * trigger rather than another field beside the flow. There is no default access: an unstated rule is either a
     * lock-out or a hole, so the type demands one.
     *
     * Anything a caller sends that `input` does not declare is DROPPED before a single step runs, which is what
     * makes interpolating `{{ input.* }}` into a later step's params safe.
     */
    trigger: {
      type: 'call',
      access: 'public',
      input: {
        city: { type: 'text', required: true, label: 'Destination city' },
        weightKg: { type: 'number', defaultValue: 1, label: 'Weight (kg)' }
      }
    },
    // Params written out because this step takes something the caller did not send: the rate, which belongs to the
    // document rather than to the request. A step that names none takes the declared input one field at a time.
    steps: [
      { id: 'rate', task: 'example.shippingRate', params: { city: '{{input.city}}', weightKg: '{{input.weightKg}}', ratePerKg } }
    ],
    /**
     * The contract. What this names is exactly what the caller receives — `band`, which the task also returned,
     * stays on the server because nothing here names it.
     *
     * An unquoted token keeps its type (`{{ rate.total }}` is a number); a quoted one is text. There is nothing
     * else to declare and nothing that can disagree with it.
     */
    output: `{"total": {{ rate.total }}, "currency": "{{ rate.currency }}", "summary": "{{ rate.city }}: {{ rate.total }} {{ rate.currency }} — quoted by the ${label}"}`
  });

/**
 * The other way in: a sender the space does not control, posting to a public URL.
 *
 * Public by construction, so the signature IS the security boundary — checked against the raw bytes, before the
 * body is parsed and before any work starts. The secret is a template resolved against the credentials this
 * document declared, and reaches nothing else.
 */
const visitDigest: ActionEntry = defineAction({
  id: 'visit-digest',
  name: 'Visit digest',
  trigger: {
    type: 'webhook',
    access: 'public',
    input: { event: { type: 'text', required: true, label: 'Event name' } },
    /**
     * The credential is NAMED, not templated. This check runs before the body is parsed and before a run exists,
     * so there is no flow scope for a token to resolve against — and one that rendered to nothing would leave the
     * endpoint verifying every request against an empty secret.
     *
     * Naming it is also the whole of turning verification on: everything else here has a default, so there is no
     * half-configured state where the endpoint looks protected and is not.
     */
    verify: { credential: 'example', secretField: 'webhookSecret', header: 'x-example-signature' }
  },
  steps: [{ id: 'count', task: 'kv.increment', params: { key: 'visits:{{input.event}}', amount: '1' } }],
  output: '{"event": "{{input.event}}", "seen": {{ count.value }}}'
});

/** The live documents — what the builder edits, and what a webhook or a schedule runs. */
const draft: ActionEntry[] = [shippingQuote(5.5, 'draft'), visitDigest];

/**
 * What publishing left behind: a copy of every action, tagged with the environment and revision it went out as.
 *
 * Written by the publish, never edited afterwards — a published copy is the record of what shipped. This example
 * ships one revision; a real store has a row per action per revision.
 */
const published: Record<string, ActionEntry[]> = {
  'production@2': [shippingQuote(4, 'copy published at revision 2'), visitDigest]
};

const versionKey = (at?: SpaceRevision): string | undefined =>
  at && at.environment !== 'main' && at.revision > 0 ? `${at.environment}@${at.revision}` : undefined;

/**
 * How the server reaches an action, and the one rule worth copying: **`at` decides which version answers.**
 *
 * It is set when a PAGE started the run, and it carries the revision that page was published at. Absent — a
 * webhook, a schedule, a trigger the deployment mounted itself — means the live document, because nothing about a
 * sender or a clock names a revision, and one pinned to an old one would keep answering with a flow its author
 * already corrected.
 *
 * A revision with no copy falls back to the live document rather than refusing: a space published before its
 * actions were versioned would otherwise stop working, which is a correctness fix breaking what it protects.
 */
const getAction = (_spaceId: number, actionId: string, at?: SpaceRevision): Promise<ActionEntry | undefined> => {
  const key = versionKey(at);
  const copies = key ? published[key] : undefined;

  return Promise.resolve((copies ?? draft).find(entry => entry.id === actionId) ?? draft.find(e => e.id === actionId));
};

/**
 * The secrets an action may resolve, by identifier.
 *
 * Never in the flow scope: a step that needs one names it, and its values exist only while that step's own params
 * render. An ambient `{{ credential.* }}` would be interpolable by every step, the output step included — which is
 * a secret handed to the browser through a step nobody would think to audit.
 */
const getCredential = (_spaceId: number, identifier: string): Promise<Record<string, string> | undefined> =>
  Promise.resolve(identifier === 'example' ? { webhookSecret: 'example-webhook-secret' } : undefined);

export const lookups: ActionLookups = { getAction, getCredential };
