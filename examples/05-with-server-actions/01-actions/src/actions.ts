import type { ActionLookups } from '@plitzi/sdk-server/actions';
import type { ActionEntry, ElementInteraction, SpaceRevision } from '@plitzi/sdk-shared';

/**
 * Where this deployment keeps its actions, and what it answers when the server asks for one.
 *
 * An action is a DOCUMENT, not code: the same shape the builder authors and the runner executes. A real deployment
 * reads these rows from its database; here they are two objects, because the shape is the same either way and the
 * wiring is the part worth reading.
 */

const node = (id: string, overrides: Partial<ElementInteraction> = {}): ElementInteraction =>
  ({
    id,
    title: id,
    type: 'task',
    action: '',
    params: {},
    preview: {},
    elementId: null,
    beforeNode: '',
    afterNode: '',
    flowId: 'flow',
    enabled: true,
    ...overrides
  }) as ElementInteraction;

/**
 * The same action, priced two ways.
 *
 * `ratePerKg` is what somebody edited after the space was published, and `label` is how you can tell the two
 * apart from outside — because everything else about them is identical. Publishing copied the flow as it read at
 * the time, so the published site keeps quoting the old rate until it is published again.
 */
const shippingQuote = (ratePerKg: number, label: string): ActionEntry => ({
  id: 'shipping-quote',
  document: {
    name: 'Shipping quote',
    description: 'Prices a parcel for the visitor filling in the form.',
    nodes: {
      /**
       * The way in, and everything about it: what starts the run, who may start it, what they may send — and,
       * in the step's own `enabled`, whether it is open at all. There is no second switch beside the flow: an
       * action is on when a way into it is.
       *
       * It is a STEP, exactly as an element's `onClick` is — which is why a second way in is a second trigger step
       * rather than another field beside the flow. There is no default access: an unstated rule is either a
       * lock-out or a hole, so the step states one.
       *
       * Anything a caller sends that `input` does not declare is DROPPED before a single step runs, which is what
       * makes interpolating `{{ input.* }}` into a later step's params safe.
       */
      start: node('start', {
        type: 'trigger',
        action: 'call',
        params: {
          access: 'public',
          input: JSON.stringify({
            city: { type: 'text', required: true, label: 'Destination city' },
            weightKg: { type: 'number', defaultValue: 1, label: 'Weight (kg)' }
          })
        },
        afterNode: 'rate'
      }),
      rate: node('rate', {
        action: 'example.shippingRate',
        params: { city: '{{input.city}}', weightKg: '{{input.weightKg}}', ratePerKg },
        beforeNode: 'start',
        afterNode: 'answer'
      }),
      /**
       * The contract. What this step names is exactly what the caller receives — `band`, which the task also
       * returned, stays on the server because no step named it.
       *
       * An unquoted token keeps its type (`{{ rate.total }}` is a number); a quoted one is text. There is nothing
       * else to declare and nothing that can disagree with it.
       */
      answer: node('answer', {
        action: 'flow.output',
        params: {
          values: `{"total": {{ rate.total }}, "currency": "{{ rate.currency }}", "summary": "{{ rate.city }}: {{ rate.total }} {{ rate.currency }} — quoted by the ${label}"}`
        },
        beforeNode: 'rate'
      })
    }
  }
});

/**
 * The other way in: a sender the space does not control, posting to a public URL.
 *
 * Public by construction, so the signature IS the security boundary — checked against the raw bytes, before the
 * body is parsed and before any work starts. The secret is a template resolved against the credentials this
 * document declared, and reaches nothing else.
 */
const visitDigest: ActionEntry = {
  id: 'visit-digest',
  document: {
    name: 'Visit digest',
    nodes: {
      start: node('start', {
        type: 'trigger',
        action: 'webhook',
        params: {
          access: 'public',
          input: JSON.stringify({ event: { type: 'text', required: true, label: 'Event name' } }),
          // The credential is NAMED here, not templated. This check runs before the body is parsed and before a
          // run exists, so there is no flow scope for a token to resolve against — and one that rendered to
          // nothing would leave the endpoint verifying every request against an empty secret.
          verify: JSON.stringify({
            type: 'hmac',
            header: 'x-example-signature',
            algorithm: 'sha256',
            credential: 'example',
            secretField: 'webhookSecret'
          })
        },
        afterNode: 'count'
      }),
      count: node('count', {
        action: 'kv.increment',
        params: { key: 'visits:{{input.event}}', amount: '1' },
        beforeNode: 'start',
        afterNode: 'answer'
      }),
      answer: node('answer', {
        action: 'flow.output',
        params: { values: '{"event": "{{input.event}}", "seen": {{ count.value }}}' },
        beforeNode: 'count'
      })
    }
  }
};

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
